import { format, parseISO } from "date-fns";
import { buildDays, categoryTotals, formatDayLabel, sortTx, sum } from "./calc";
import { categoryDef } from "./types";
import type { MoneyState, Transaction, ViewMode } from "./types";

export type NodeKind =
  | "root"
  | "month"
  | "date"
  | "spent"
  | "left"
  | "income"
  | "category"
  | "transaction"
  | "forecast";

export type Tone = "income" | "expense" | "balance" | "pending" | "forecast" | "neutral";

export interface TreeNode {
  id: string;
  kind: NodeKind;
  tone: Tone;
  icon?: string | undefined;
  label: string;
  amount: number;
  sublabel?: string | undefined;
  date?: string | undefined;
  category?: string | undefined;
  txId?: string | undefined;
  txIds: string[];
  children: TreeNode[];
  collapsedByDefault?: boolean | undefined;
  /** Running balance before this node's money movement. */
  balanceBefore?: number | undefined;
  /** Running balance after this node's money movement. */
  balanceAfter?: number | undefined;
}


export interface PositionedNode extends TreeNode {
  x: number;
  y: number;
  depth: number;
  hasChildren: boolean;
  collapsed: boolean;
}

export interface Edge {
  id: string;
  from: PositionedNode;
  to: PositionedNode;
  tone: Tone;
  dashed?: boolean | undefined;
}

export const NODE_W = 186;
export const NODE_H = 90;
const GAP_X = 26;
const GAP_Y = 108;

type BalanceMap = Map<string, { before: number; after: number }>;

/** Chronological running balance for a single day, starting from its opening balance. */
function dayBalances(opening: number, txs: Transaction[]): BalanceMap {
  const map: BalanceMap = new Map();
  let running = opening;
  sortTx(txs).forEach((t) => {
    const before = running;
    running += t.type === "income" ? t.amount : -t.amount;
    map.set(t.id, { before, after: running });
  });
  return map;
}

function spanBalance(ids: string[], balances: BalanceMap, fallback: number) {
  const entries = ids.map((id) => balances.get(id)).filter(Boolean) as {
    before: number;
    after: number;
  }[];
  if (!entries.length) return { before: fallback, after: fallback };
  return { before: entries[0]!.before, after: entries[entries.length - 1]!.after };
}

function txNode(t: Transaction, balances: BalanceMap): TreeNode {
  const def = categoryDef(t.category);
  const b = balances.get(t.id);
  return {
    id: `tx-${t.id}`,
    kind: "transaction",
    tone: t.type === "income" ? "income" : "expense",
    icon: def.icon,
    label: t.subcategory || t.description || t.category,
    amount: t.amount,
    sublabel: t.time,
    date: t.date,
    category: t.category,
    txId: t.id,
    txIds: [t.id],
    children: [],
    balanceBefore: b?.before,
    balanceAfter: b?.after,
  };
}

function categoryNodes(
  txs: Transaction[],
  keyPrefix: string,
  type: "expense" | "income",
  balances: BalanceMap,
  fallback: number,
) {
  return categoryTotals(txs, type).map((c) => {
    const items = sortTx(txs.filter((t) => t.type === type && t.category === c.category));
    const total = sum(txs.filter((t) => t.type === type).map((t) => t.amount));
    const def = categoryDef(c.category);
    const span = spanBalance(
      items.map((t) => t.id),
      balances,
      fallback,
    );
    return {
      id: `${keyPrefix}-cat-${c.category}`,
      kind: "category" as NodeKind,
      tone: type === "income" ? ("income" as Tone) : ("expense" as Tone),
      icon: def.icon,
      label: c.category,
      amount: c.total,
      sublabel: total > 0 ? `${Math.round((c.total / total) * 100)}% · ${c.count} tx` : undefined,
      category: c.category,
      txIds: items.map((t) => t.id),
      children: items.map((t) => txNode(t, balances)),
      collapsedByDefault: items.length > 3,
      balanceBefore: span.before,
      balanceAfter: span.after,
    };
  });
}

function dateNode(
  day: { date: string; opening: number; income: number; spent: number; closing: number; transactions: Transaction[] },
  view: ViewMode,
): TreeNode {
  const children: TreeNode[] = [];
  const incomeTx = day.transactions.filter((t) => t.type === "income");
  const expenseTx = day.transactions.filter((t) => t.type === "expense");
  const balances = dayBalances(day.opening, day.transactions);

  if (incomeTx.length) {
    const span = spanBalance(
      sortTx(incomeTx).map((t) => t.id),
      balances,
      day.opening,
    );
    children.push({
      id: `${day.date}-income`,
      kind: "income",
      tone: "income",
      icon: "🌱",
      label: "RECEIVED",
      amount: day.income,
      sublabel: `${incomeTx.length} source${incomeTx.length > 1 ? "s" : ""}`,
      date: day.date,
      txIds: incomeTx.map((t) => t.id),
      children: categoryNodes(incomeTx, `${day.date}-in`, "income", balances, day.opening),
      balanceBefore: span.before,
      balanceAfter: span.after,
    });
  }

  if (expenseTx.length) {
    const span = spanBalance(
      sortTx(expenseTx).map((t) => t.id),
      balances,
      day.closing,
    );
    children.push({
      id: `${day.date}-spent`,
      kind: "spent",
      tone: "expense",
      icon: "💸",
      label: "SPENT",
      amount: day.spent,
      sublabel: `${expenseTx.length} transaction${expenseTx.length > 1 ? "s" : ""}`,
      date: day.date,
      txIds: expenseTx.map((t) => t.id),
      children: categoryNodes(expenseTx, `${day.date}-out`, "expense", balances, day.closing),
      balanceBefore: span.before,
      balanceAfter: span.after,
    });
  }

  children.push({
    id: `${day.date}-left`,
    kind: "left",
    tone: "balance",
    icon: "🌳",
    label: "LEFT",
    amount: day.closing,
    sublabel: "carried forward",
    date: day.date,
    txIds: [],
    children: [],
    balanceBefore: day.opening,
    balanceAfter: day.closing,
  });

  return {
    id: `date-${day.date}`,
    kind: "date",
    tone: "neutral",
    label: formatDayLabel(day.date),
    amount: day.opening,
    sublabel: format(parseISO(day.date), "EEEE"),
    date: day.date,
    txIds: day.transactions.map((t) => t.id),
    children,
    collapsedByDefault: view === "month" || view === "year",
    balanceBefore: day.opening,
    balanceAfter: day.closing,
  };
}


export interface BuildOptions {
  view: ViewMode;
  from: string;
  to: string;
  filteredTx: Transaction[];
  projection?: { days: number; balance: number } | undefined;
}

export function buildTree(state: MoneyState, opts: BuildOptions): TreeNode {
  const days = buildDays(state, state.transactions).filter(
    (d) => d.date >= opts.from && d.date <= opts.to,
  );
  const visibleIds = new Set(opts.filteredTx.map((t) => t.id));
  const scoped = days
    .map((d) => ({ ...d, transactions: d.transactions.filter((t) => visibleIds.has(t.id)) }))
    .filter((d) => d.transactions.length > 0 || opts.view === "day");

  const rootAmount = scoped.length ? scoped[0]!.opening : state.startingBalance;
  const children: TreeNode[] = [];

  if (opts.view === "year") {
    const byMonth = new Map<string, typeof scoped>();
    scoped.forEach((d) => {
      const key = d.date.slice(0, 7);
      byMonth.set(key, [...(byMonth.get(key) ?? []), d]);
    });
    [...byMonth.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([month, list]) => {
        children.push({
          id: `month-${month}`,
          kind: "month",
          tone: "neutral",
          label: format(parseISO(`${month}-01`), "MMMM").toUpperCase(),
          amount: sum(list.map((d) => d.spent)),
          sublabel: `spent · ${list.length} days`,
          date: `${month}-01`,
          txIds: list.flatMap((d) => d.transactions.map((t) => t.id)),
          children: list.map((d) => dateNode(d, opts.view)),
          collapsedByDefault: true,
          balanceBefore: list[0]!.opening,
          balanceAfter: list[list.length - 1]!.closing,
        });
      });
  } else {
    scoped.forEach((d) => children.push(dateNode(d, opts.view)));
  }

  if (opts.projection) {
    children.push({
      id: "forecast",
      kind: "forecast",
      tone: "forecast",
      icon: "🔮",
      label: `IN ${opts.projection.days} DAYS`,
      amount: opts.projection.balance,
      sublabel: "projected estimate",
      txIds: [],
      children: [],
      balanceBefore: scoped.length ? scoped[scoped.length - 1]!.closing : state.startingBalance,
      balanceAfter: opts.projection.balance,
    });
  }


  return {
    id: "root",
    kind: "root",
    tone: "balance",
    icon: "🪙",
    label: "START BALANCE",
    amount: rootAmount,
    sublabel: opts.view === "day" ? "opening balance" : "beginning of period",
    txIds: [],
    children,
  };
}

export function layoutTree(root: TreeNode, collapsed: Set<string>) {
  const nodes: PositionedNode[] = [];
  const edges: Edge[] = [];
  let cursor = 0;

  function walk(node: TreeNode, depth: number): PositionedNode {
    const isCollapsed = collapsed.has(node.id);
    const kids = isCollapsed ? [] : node.children;
    let x: number;
    if (kids.length === 0) {
      x = cursor;
      cursor += NODE_W + GAP_X;
    } else {
      const placed = kids.map((k) => walk(k, depth + 1));
      x = (placed[0]!.x + placed[placed.length - 1]!.x) / 2;
      const self: PositionedNode = {
        ...node,
        x,
        y: depth * (NODE_H + GAP_Y),
        depth,
        hasChildren: node.children.length > 0,
        collapsed: isCollapsed,
      };
      nodes.push(self);
      placed.forEach((p) =>
        edges.push({
          id: `${self.id}->${p.id}`,
          from: self,
          to: p,
          tone: p.tone,
          dashed: p.kind === "forecast",
        }),
      );
      return self;
    }
    const self: PositionedNode = {
      ...node,
      x,
      y: depth * (NODE_H + GAP_Y),
      depth,
      hasChildren: node.children.length > 0,
      collapsed: isCollapsed,
    };
    nodes.push(self);
    return self;
  }

  walk(root, 0);
  const width = Math.max(cursor, NODE_W) + NODE_W;
  const depth = nodes.reduce((m, n) => Math.max(m, n.depth), 0);
  const height = (depth + 1) * (NODE_H + GAP_Y);
  return { nodes, edges, width, height };
}

export function defaultCollapsed(root: TreeNode) {
  const set = new Set<string>();
  function walk(n: TreeNode) {
    if (n.collapsedByDefault) set.add(n.id);
    n.children.forEach(walk);
  }
  walk(root);
  return set;
}

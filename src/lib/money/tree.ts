import { format, parseISO, startOfWeek } from "date-fns";
import { ISO, buildDays, categoryTotals, formatDayLabel, sortTx, sum } from "./calc";
import {
  investmentGainPct,
  investmentValue,
  portfolioSummary,
  sortInvestments,
} from "./investments";
import { categoryDef, investmentKindDef } from "./types";
import type { MoneyState, Transaction, ViewMode } from "./types";

export type NodeKind =
  | "root"
  | "month"
  | "week"
  | "date"
  | "spent"
  | "left"
  | "income"
  | "category"
  | "transaction"
  | "investment"
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
export const NODE_H = 108;
const GAP_X = 34;
const GAP_Y = 120;

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

    // Single-transaction category: no point in a wrapper branch — show the leaf itself.
    if (items.length === 1) {
      const only = items[0]!;
      const leaf = txNode(only, balances);
      return {
        ...leaf,
        id: `${keyPrefix}-cat-${c.category}`,
        label: c.category,
        icon: def.icon,
        sublabel: [only.subcategory || only.description, only.time].filter(Boolean).join(" · "),
        children: [],
      };
    }

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
      balanceAfter: type === "income" ? span.before + c.total : span.before - c.total,
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
      balanceAfter: span.before + day.income,
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
      balanceAfter: span.before - day.spent,
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


/** Groups a list of day-summaries into week-level TreeNodes. */
function buildWeekNodes(
  list: { date: string; opening: number; income: number; spent: number; closing: number; transactions: Transaction[] }[],
  groupKey: string,
  view: ViewMode,
): TreeNode[] {
  const byWeek = new Map<string, typeof list>();
  list.forEach((d) => {
    const ws = format(startOfWeek(parseISO(d.date), { weekStartsOn: 1 }), ISO);
    byWeek.set(ws, [...(byWeek.get(ws) ?? []), d]);
  });

  let weekIdx = 0;
  return [...byWeek.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([weekStart, days]) => {
      weekIdx++;
      const first = days[0]!;
      const last = days[days.length - 1]!;
      const totalSpent = sum(days.map((d) => d.spent));
      const totalIncome = sum(days.map((d) => d.income));
      const parts = [`${formatDayLabel(first.date)} – ${formatDayLabel(last.date)}`];
      if (totalIncome > 0) parts.push(`+₹${totalIncome.toLocaleString("en-IN")}`);
      parts.push(`${days.length} day${days.length > 1 ? "s" : ""}`);
      return {
        id: `week-${groupKey}-${weekStart}`,
        kind: "week" as NodeKind,
        tone: "neutral" as Tone,
        icon: "🗓️",
        label: `WEEK ${weekIdx}`,
        amount: totalSpent,
        sublabel: parts.join(" · "),
        date: first.date,
        txIds: days.flatMap((d) => d.transactions.map((t) => t.id)),
        children: days.map((d) => dateNode(d, view)),
        collapsedByDefault: true,
        balanceBefore: first.opening,
        balanceAfter: last.closing,
      };
    });
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
  const yearLabel = opts.from.slice(0, 4);
  const scoped = days
    .map((d) => ({ ...d, transactions: d.transactions.filter((t) => visibleIds.has(t.id)) }))
    .filter((d) => d.transactions.length > 0 || opts.view === "day");

  const rootAmount = scoped.length ? scoped[0]!.opening : state.startingBalance;
  const children: TreeNode[] = [];

  if (opts.view === "year") {
    // Year: Root → Month → Week → Day
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
          sublabel: `${list.length} day${list.length > 1 ? "s" : ""} · ₹${sum(list.map((d) => d.spent)).toLocaleString("en-IN")} spent`,
          date: `${month}-01`,
          txIds: list.flatMap((d) => d.transactions.map((t) => t.id)),
          children: buildWeekNodes(list, month, opts.view),
          collapsedByDefault: true,
          balanceBefore: list[0]!.opening,
          balanceAfter: list[list.length - 1]!.closing,
        });
      });
  } else if (opts.view === "month") {
    // Month: Root → Week → Day
    const weekNodes = buildWeekNodes(scoped, opts.from.slice(0, 7), opts.view);
    weekNodes.forEach((w) => children.push(w));
  } else {
    // Day / Week: Root → Day directly
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

  // Investment branch — built from the user's real holdings; skipped when there are none.
  if (state.investments.length > 0) {
    const summary = portfolioSummary(state.investments);
    children.push({
      id: "investment",
      kind: "investment",
      tone: "neutral",
      icon: "📈",
      label: "INVESTMENT",
      amount: summary.value,
      sublabel: `${summary.count} holding${summary.count > 1 ? "s" : ""} · ${summary.gain >= 0 ? "+" : ""}${summary.gainPct.toFixed(1)}%`,
      txIds: [],
      collapsedByDefault: true,
      balanceBefore: summary.principal,
      balanceAfter: summary.value,
      children: sortInvestments(state.investments).map((inv) => {
        const def = investmentKindDef(inv.kind);
        const value = investmentValue(inv);
        const gain = value - inv.principal;
        const pct = investmentGainPct(inv);
        return {
          id: `investment-${inv.id}`,
          kind: "investment" as NodeKind,
          tone: "neutral" as Tone,
          icon: def.icon,
          label: inv.name.toUpperCase(),
          amount: value,
          sublabel: `${def.label} · ${gain >= 0 ? "+" : ""}${pct.toFixed(1)}%`,
          date: inv.startDate,
          txIds: [],
          children: [],
          balanceBefore: inv.principal,
          balanceAfter: value,
        };
      }),
    });
  }

  /**
   * Removes pass-through branches: a node whose single child carries the same amount
   * adds no information, so the child is merged into the parent.
   */
  function collapseRedundant(node: TreeNode): TreeNode {
    const children = node.children.map(collapseRedundant);
    if (children.length === 1) {
      const only = children[0]!;
      const mergeable =
        only.amount === node.amount &&
        (node.kind === "income" || node.kind === "spent" || node.kind === "category");
      if (mergeable) {
        return {
          ...node,
          sublabel: only.sublabel ?? node.sublabel,
          children: only.children,
          balanceBefore: node.balanceBefore,
          balanceAfter: node.balanceAfter,
        };
      }
    }
    return { ...node, children };
  }


  return collapseRedundant({
    id: "root",
    kind: "root",
    tone: "balance",
    icon: "🪙",
    label: opts.view === "year" ? yearLabel : "START BALANCE",
    amount: rootAmount,
    sublabel: opts.view === "year" ? "yearly overview" : opts.view === "day" ? "opening balance" : "beginning of period",
    txIds: [],
    children,
    balanceBefore: rootAmount,
    balanceAfter: scoped.length ? scoped[scoped.length - 1]!.closing : rootAmount,
  });


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

import { ChevronDown, Palette } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface Swatch {
  label: string;
  hint: string;
  color: string;
  ring?: boolean;
  dashed?: boolean;
}

const STRUCTURE: Swatch[] = [
  { label: "Root", hint: "Your whole period", color: "var(--node-root)" },
  { label: "Date / month", hint: "Time branches", color: "var(--node-primary)" },
  { label: "Category", hint: "Grouped spend or income", color: "var(--node-standard)" },
  { label: "Transaction", hint: "A single entry", color: "var(--node-secondary)" },
];

const STATUS: Swatch[] = [
  { label: "Income", hint: "Money in", color: "var(--income)" },
  { label: "Expense", hint: "Money out", color: "var(--expense)" },
  { label: "Pending", hint: "Awaiting settlement", color: "var(--pending)" },
  { label: "Forecast", hint: "Projected, not real yet", color: "var(--forecast)", dashed: true },
];

function Dot({ item }: { item: Swatch }) {
  return (
    <span
      className={cn(
        "mt-0.5 size-3 shrink-0 rounded-full ring-2 ring-canvas",
        item.dashed && "border-2 border-dashed bg-transparent",
      )}
      style={
        item.dashed
          ? { borderColor: item.color }
          : { background: item.color, boxShadow: "0 2px 8px -3px var(--glow)" }
      }
    />
  );
}

function Group({ title, items }: { title: string; items: Swatch[] }) {
  return (
    <div className="space-y-2">
      <div className="text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
        {title}
      </div>
      <ul className="grid gap-2">
        {items.map((item) => (
          <li key={item.label} className="flex items-start gap-2">
            <Dot item={item} />
            <div className="min-w-0 leading-tight">
              <div className="truncate text-[11px] font-semibold text-foreground">{item.label}</div>
              <div className="truncate text-[10px] text-muted-foreground">{item.hint}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ColorLegend({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className={cn("pointer-events-auto w-[212px]", className)}>
      <div className="glass-panel overflow-hidden rounded-2xl border border-border shadow-[var(--shadow-node)]">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-secondary/60"
        >
          <span
            className="flex size-6 items-center justify-center rounded-lg text-primary-foreground"
            style={{ background: "var(--gradient-accent, var(--primary))" }}
          >
            <Palette className="size-3.5" />
          </span>
          <span className="flex-1 text-[11px] font-semibold tracking-wide text-foreground">
            Colour legend
          </span>
          <ChevronDown
            className={cn(
              "size-3.5 text-muted-foreground transition-transform duration-200",
              open && "rotate-180",
            )}
          />
        </button>

        {!open && (
          <div className="flex items-center gap-1.5 px-3 pb-3">
            {[...STRUCTURE, ...STATUS].map((item) => (
              <span
                key={item.label}
                title={`${item.label} — ${item.hint}`}
                className={cn("size-3 rounded-full", item.dashed && "border-2 border-dashed")}
                style={
                  item.dashed ? { borderColor: item.color } : { background: item.color }
                }
              />
            ))}
          </div>
        )}

        {open && (
          <div className="space-y-3.5 border-t border-border px-3 pt-3 pb-3.5">
            <Group title="Branches" items={STRUCTURE} />
            <div className="h-px bg-border" />
            <Group title="Money status" items={STATUS} />
            <div className="flex items-center gap-2 rounded-xl bg-secondary/60 px-2.5 py-2">
              <span className="mt-0 h-1 w-6 shrink-0 rounded-full bg-primary shadow-[0_0_6px_var(--glow)]" />
              <span className="text-[10px] leading-tight text-muted-foreground">
                Glowing line = the active path you are hovering
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

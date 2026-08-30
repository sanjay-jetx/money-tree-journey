import { Check } from "lucide-react";
import { ACCENTS, ACCENT_INTENSITIES, accentSwatches } from "@/lib/money/accent";
import { useMoney } from "@/lib/money/store";
import { cn } from "@/lib/utils";

export function AccentPicker() {
  const { state, setAccent, setAccentIntensity } = useMoney();

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {ACCENTS.map((preset) => {
          const active = state.accent === preset.name;
          const swatches = accentSwatches(preset.name, state.accentIntensity);
          return (
            <button
              key={preset.name}
              type="button"
              onClick={() => setAccent(preset.name)}
              aria-pressed={active}
              className={cn(
                "group rounded-2xl border p-3 text-left transition-all",
                active
                  ? "border-primary bg-primary/10 shadow-glow"
                  : "border-border bg-surface/70 hover:border-primary/50",
              )}
            >
              <div className="flex items-center gap-1.5">
                {swatches.map((color) => (
                  <span
                    key={color}
                    className="h-6 flex-1 rounded-full"
                    style={{ background: color }}
                  />
                ))}
                {active ? <Check className="size-4 text-primary" aria-hidden /> : null}
              </div>
              <p className="mt-2 text-sm font-medium">{preset.label}</p>
              <p className="text-[11px] text-muted-foreground">{preset.hint}</p>
            </button>
          );
        })}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Accent intensity</p>
          <p className="font-mono text-xs text-muted-foreground">
            {state.accentIntensity} / {ACCENT_INTENSITIES.length}
          </p>
        </div>
        <div className="flex gap-2">
          {ACCENT_INTENSITIES.map((level) => {
            const active = state.accentIntensity === level;
            const color = accentSwatches(state.accent, level)[2]!;
            return (
              <button
                key={level}
                type="button"
                onClick={() => setAccentIntensity(level)}
                aria-label={`Intensity ${level}`}
                aria-pressed={active}
                className={cn(
                  "h-9 flex-1 rounded-xl border transition-all",
                  active ? "border-foreground/50 ring-2 ring-primary" : "border-border/70",
                )}
                style={{ background: color }}
              />
            );
          })}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Softer on the left, richer on the right — buttons, the root node and glows update live.
        </p>
      </div>
    </div>
  );
}

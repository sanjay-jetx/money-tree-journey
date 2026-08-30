export type AccentName = "copper" | "lavender" | "olive" | "teal" | "rose";

export interface AccentPreset {
  name: AccentName;
  label: string;
  hint: string;
  /** oklch hue */
  hue: number;
  /** base chroma at intensity 3 */
  chroma: number;
}

export const ACCENTS: AccentPreset[] = [
  { name: "copper", label: "Copper", hint: "warm sand default", hue: 62, chroma: 0.11 },
  { name: "lavender", label: "Lavender", hint: "soft violet", hue: 295, chroma: 0.11 },
  { name: "olive", label: "Olive", hint: "living green", hue: 142, chroma: 0.1 },
  { name: "teal", label: "Teal", hint: "cool calm", hue: 196, chroma: 0.1 },
  { name: "rose", label: "Rose", hint: "warm blush", hue: 22, chroma: 0.11 },
];

export const ACCENT_INTENSITIES = [1, 2, 3, 4, 5] as const;

const CHROMA_SCALE: Record<number, number> = { 1: 0.45, 2: 0.7, 3: 1, 4: 1.28, 5: 1.55 };

function oklch(l: number, c: number, h: number) {
  return `oklch(${l.toFixed(3)} ${c.toFixed(3)} ${h.toFixed(1)})`;
}

export function accentPreset(name: AccentName): AccentPreset {
  return ACCENTS.find((a) => a.name === name) ?? ACCENTS[0]!;
}

/** Swatch colors for the picker UI (independent of the live theme). */
export function accentSwatches(name: AccentName, intensity: number): string[] {
  const p = accentPreset(name);
  const c = p.chroma * (CHROMA_SCALE[intensity] ?? 1);
  return [oklch(0.78, c * 0.5, p.hue), oklch(0.66, c * 0.8, p.hue), oklch(0.56, c, p.hue)];
}

/** CSS variables that re-tint the accent surface of the whole UI. */
export function accentVars(
  name: AccentName,
  intensity: number,
  theme: "light" | "dark",
): Record<string, string> {
  const p = accentPreset(name);
  const c = p.chroma * (CHROMA_SCALE[intensity] ?? 1);
  const h = p.hue;
  const dark = theme === "dark";

  const primaryL = dark ? 0.72 : 0.57;
  const primary = oklch(primaryL, c, h);
  const primaryDeep = oklch(primaryL - (dark ? 0.1 : 0.09), c * 0.95, h);
  const primaryLift = oklch(primaryL + (dark ? 0.07 : 0.08), c * 0.9, h);

  return {
    "--primary": primary,
    "--primary-foreground": dark ? oklch(0.16, 0.02, h) : oklch(0.99, 0.005, h),
    "--ring": primary,
    "--accent": dark ? oklch(0.3, c * 0.35, h) : oklch(0.93, c * 0.35, h),
    "--accent-foreground": dark ? oklch(0.85, c * 0.6, h) : oklch(0.42, c * 0.85, h),
    "--secondary-foreground": dark ? oklch(0.82, c * 0.6, h) : oklch(0.45, c * 0.85, h),
    "--sidebar-accent": primary,
    "--glow": `color-mix(in oklab, ${primary} ${dark ? 34 : 28}%, transparent)`,
    "--gradient-accent": `linear-gradient(135deg, ${primaryLift} 0%, ${primary} 52%, ${primaryDeep} 100%)`,
    "--node-root": primary,
    "--node-root-text": dark ? oklch(0.16, 0.02, h) : oklch(0.99, 0.005, h),
    "--node-root-soft": `color-mix(in oklab, ${primary} 18%, var(--surface))`,
    "--forecast": primary,
    "--grain-1": `color-mix(in oklab, ${primary} ${dark ? 12 : 16}%, transparent)`,
  };
}

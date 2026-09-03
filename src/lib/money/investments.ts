import { differenceInCalendarDays, parseISO } from "date-fns";
import { todayISO } from "./calc";
import type { Investment } from "./types";

/** Fractional years between the investment start date and `asOf` (never negative). */
export function yearsHeld(inv: Investment, asOf: string = todayISO()) {
  const days = differenceInCalendarDays(parseISO(asOf), parseISO(inv.startDate));
  return Math.max(0, days / 365);
}

/**
 * Value of an investment today: a manual override wins, otherwise the principal
 * grown by simple or compound interest for the time it has been held.
 */
export function investmentValue(inv: Investment, asOf: string = todayISO()) {
  if (typeof inv.currentValue === "number" && inv.currentValue > 0) return inv.currentValue;
  const years = yearsHeld(inv, asOf);
  const rate = inv.annualRate / 100;
  if (inv.interestMode === "none" || rate === 0) return inv.principal;
  if (inv.interestMode === "simple") return inv.principal * (1 + rate * years);
  return inv.principal * Math.pow(1 + rate, years);
}

export function investmentGain(inv: Investment, asOf?: string) {
  return investmentValue(inv, asOf) - inv.principal;
}

export function investmentGainPct(inv: Investment, asOf?: string) {
  if (inv.principal <= 0) return 0;
  return (investmentGain(inv, asOf) / inv.principal) * 100;
}

export interface PortfolioSummary {
  principal: number;
  value: number;
  gain: number;
  gainPct: number;
  count: number;
}

export function portfolioSummary(list: Investment[], asOf?: string): PortfolioSummary {
  const principal = list.reduce((s, i) => s + i.principal, 0);
  const value = list.reduce((s, i) => s + investmentValue(i, asOf), 0);
  const gain = value - principal;
  return {
    principal,
    value,
    gain,
    gainPct: principal > 0 ? (gain / principal) * 100 : 0,
    count: list.length,
  };
}

export function sortInvestments(list: Investment[], asOf?: string) {
  return [...list].sort((a, b) => investmentValue(b, asOf) - investmentValue(a, asOf));
}

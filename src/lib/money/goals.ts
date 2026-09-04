import { differenceInCalendarDays, parseISO } from "date-fns";
import type { Goal, GoalStatus } from "./types";
import { todayISO } from "./calc";

export function goalProgressPct(goal: Goal): number {
  if (goal.targetAmount <= 0) return 0;
  return Math.min(100, Math.max(0, (goal.savedAmount / goal.targetAmount) * 100));
}

export function goalRemaining(goal: Goal): number {
  return Math.max(0, goal.targetAmount - goal.savedAmount);
}

export function goalDaysRemaining(goal: Goal, today: string = todayISO()): number {
  return differenceInCalendarDays(parseISO(goal.targetDate), parseISO(today));
}

export function goalStatus(goal: Goal, today: string = todayISO()): GoalStatus {
  if (goal.savedAmount >= goal.targetAmount) return "completed";
  return goalDaysRemaining(goal, today) < 0 ? "overdue" : "active";
}

/** Recommended monthly saving for an active goal with a future target date. */
export function goalMonthlySaving(goal: Goal, today: string = todayISO()): number | null {
  if (goalStatus(goal, today) !== "active") return null;
  const days = goalDaysRemaining(goal, today);
  if (days <= 0) return null;
  const months = Math.max(1, Math.round(days / 30.44));
  return goalRemaining(goal) / months;
}

export function goalMonthsRemaining(goal: Goal, today: string = todayISO()): number {
  const days = Math.max(0, goalDaysRemaining(goal, today));
  return Math.max(1, Math.round(days / 30.44));
}

const ORDER: Record<GoalStatus, number> = { active: 0, overdue: 1, completed: 2 };

export function sortGoals(goals: Goal[], today: string = todayISO()): Goal[] {
  return [...goals].sort((a, b) => {
    const diff = ORDER[goalStatus(a, today)] - ORDER[goalStatus(b, today)];
    if (diff !== 0) return diff;
    return a.targetDate.localeCompare(b.targetDate);
  });
}

export interface GoalsSummary {
  total: number;
  saved: number;
  target: number;
  completed: number;
  active: number;
  overdue: number;
}

export function goalsSummary(goals: Goal[], today: string = todayISO()): GoalsSummary {
  const summary: GoalsSummary = {
    total: goals.length,
    saved: 0,
    target: 0,
    completed: 0,
    active: 0,
    overdue: 0,
  };
  for (const g of goals) {
    summary.saved += g.savedAmount;
    summary.target += g.targetAmount;
    summary[goalStatus(g, today)] += 1;
  }
  return summary;
}

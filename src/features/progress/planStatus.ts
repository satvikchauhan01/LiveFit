import type { PlanEnrollment } from '@/db/schema';
import { weekOf } from '@/features/workouts/weeks';
import type { WorkoutListItem } from '@/features/workouts/workoutRepository';
import { currentWeekKey, parseDateKey } from '@/lib/dates';

import { type PlanSession, planById, sessionsDone, type TrainingPlan } from './plans';

export type PlanStatus = {
  plan: TrainingPlan;
  /** 0-based week of the plan we're in. */
  weekIndex: number;
  finished: boolean;
  sessions: PlanSession[];
  done: boolean[];
  /** The first session not done yet this week, if any. */
  next: PlanSession | null;
};

function weeksBetween(fromKey: string, toKey: string): number {
  const from = parseDateKey(fromKey);
  const to = parseDateKey(toKey);
  const days =
    (Date.UTC(to.year, to.month - 1, to.day) - Date.UTC(from.year, from.month - 1, from.day)) /
    86_400_000;
  return Math.floor(days / 7);
}

/** Where you are in a plan this week, from the workouts you've recorded. */
export function planStatus(
  enrollment: PlanEnrollment,
  workouts: WorkoutListItem[],
): PlanStatus | null {
  const plan = planById(enrollment.planId);
  if (!plan) return null;
  const thisWeek = currentWeekKey();
  const weekIndex = Math.max(0, weeksBetween(enrollment.startWeek, thisWeek));
  const finished = weekIndex >= plan.weeks.length;
  const sessions = finished ? [] : plan.weeks[weekIndex];
  const types = workouts
    .filter((workout) => weekOf(workout) === thisWeek && workout.startedAt >= enrollment.createdAt)
    .map((workout) => workout.type);
  const done = sessionsDone(sessions, types);
  const nextIndex = done.indexOf(false);
  return {
    plan,
    weekIndex,
    finished,
    sessions,
    done,
    next: nextIndex >= 0 ? sessions[nextIndex] : null,
  };
}

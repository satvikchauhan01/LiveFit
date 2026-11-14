import * as Crypto from 'expo-crypto';
import { and, desc, eq, gte, isNotNull, isNull, max, sql } from 'drizzle-orm';

import { db } from '@/db/client';
import {
  exercises,
  type Goal,
  goals,
  type GoalKind,
  type MuscleGroup,
  type PlanEnrollment,
  planEnrollments,
  type Routine,
  routines,
  strengthSets,
  workouts,
} from '@/db/schema';
import { notifyLocalChange } from '@/features/sync/changes';

import type { RoutineItem } from './plans';

// --- Goals ---------------------------------------------------------------------------

export async function listGoals(): Promise<Goal[]> {
  return db.select().from(goals).where(isNull(goals.deletedAt)).orderBy(goals.createdAt);
}

export async function createGoal(input: {
  kind: GoalKind;
  target: number;
  activityType?: string | null;
  exerciseId?: string | null;
}): Promise<Goal> {
  const now = Date.now();
  const rows = await db
    .insert(goals)
    .values({
      id: Crypto.randomUUID(),
      kind: input.kind,
      target: input.target,
      activityType: input.activityType ?? null,
      exerciseId: input.exerciseId ?? null,
      createdAt: now,
      updatedAt: now,
      dirty: true,
    })
    .returning();
  notifyLocalChange();
  return rows[0];
}

export async function deleteGoal(id: string): Promise<void> {
  const now = Date.now();
  await db
    .update(goals)
    .set({ deletedAt: now, updatedAt: now, dirty: true })
    .where(eq(goals.id, id));
  notifyLocalChange();
}

/** Remembers that a goal's "reached" alert went out for this period (week, month…). */
export async function markGoalAchieved(id: string, period: string): Promise<void> {
  await db.update(goals).set({ lastAchievedPeriod: period }).where(eq(goals.id, id));
}

// --- Routines --------------------------------------------------------------------------

export function routineItems(routine: Routine): RoutineItem[] {
  try {
    const items = JSON.parse(routine.items) as unknown;
    return Array.isArray(items) ? (items as RoutineItem[]) : [];
  } catch {
    return [];
  }
}

export async function listRoutines(): Promise<Routine[]> {
  return db.select().from(routines).where(isNull(routines.deletedAt)).orderBy(routines.name);
}

export async function createRoutine(name: string, items: RoutineItem[]): Promise<Routine> {
  const now = Date.now();
  const rows = await db
    .insert(routines)
    .values({
      id: Crypto.randomUUID(),
      name: name.trim(),
      items: JSON.stringify(items),
      createdAt: now,
      updatedAt: now,
      dirty: true,
    })
    .returning();
  notifyLocalChange();
  return rows[0];
}

export async function deleteRoutine(id: string): Promise<void> {
  const now = Date.now();
  await db
    .update(routines)
    .set({ deletedAt: now, updatedAt: now, dirty: true })
    .where(eq(routines.id, id));
  notifyLocalChange();
}

// --- Plans -----------------------------------------------------------------------------

export async function getActiveEnrollment(): Promise<PlanEnrollment | null> {
  const rows = await db
    .select()
    .from(planEnrollments)
    .where(and(isNull(planEnrollments.endedAt), isNull(planEnrollments.deletedAt)))
    .orderBy(desc(planEnrollments.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

/** Starts a plan this week. Any plan already running is ended first. */
export async function enrollInPlan(planId: string, startWeek: string): Promise<PlanEnrollment> {
  const now = Date.now();
  await db
    .update(planEnrollments)
    .set({ endedAt: now, updatedAt: now, dirty: true })
    .where(isNull(planEnrollments.endedAt));
  const rows = await db
    .insert(planEnrollments)
    .values({
      id: Crypto.randomUUID(),
      planId,
      startWeek,
      createdAt: now,
      updatedAt: now,
      dirty: true,
    })
    .returning();
  notifyLocalChange();
  return rows[0];
}

export async function endEnrollment(id: string): Promise<void> {
  const now = Date.now();
  await db
    .update(planEnrollments)
    .set({ endedAt: now, updatedAt: now, dirty: true })
    .where(eq(planEnrollments.id, id));
  notifyLocalChange();
}

// --- Strength statistics ------------------------------------------------------------

const finishedWorkout = and(eq(workouts.status, 'finished'), isNull(workouts.deletedAt));

/** Weight × reps per muscle group since `fromMs` (an aggregate with two JOINs). */
export async function muscleVolumeSince(
  fromMs: number,
): Promise<{ muscleGroup: MuscleGroup; volumeKg: number }[]> {
  const rows = await db
    .select({
      muscleGroup: exercises.muscleGroup,
      volumeKg: sql<number>`coalesce(sum(${strengthSets.reps} * ${strengthSets.weightKg}), 0)`,
    })
    .from(strengthSets)
    .innerJoin(exercises, eq(exercises.id, strengthSets.exerciseId))
    .innerJoin(workouts, eq(workouts.id, strengthSets.workoutId))
    .where(
      and(
        finishedWorkout,
        gte(workouts.startedAt, fromMs),
        isNotNull(strengthSets.completedAt),
        eq(exercises.logType, 'weight_reps'),
      ),
    )
    .groupBy(exercises.muscleGroup);
  return rows;
}

export type LiftedSet = {
  exerciseId: string;
  exerciseName: string;
  weightKg: number;
  reps: number;
  workoutId: string;
  startedAt: number;
};

/** Every completed weighted set ever, for records and estimated 1RMs. */
export async function allWeightedSets(): Promise<LiftedSet[]> {
  const rows = await db
    .select({
      exerciseId: strengthSets.exerciseId,
      exerciseName: exercises.name,
      weightKg: strengthSets.weightKg,
      reps: strengthSets.reps,
      workoutId: strengthSets.workoutId,
      startedAt: workouts.startedAt,
    })
    .from(strengthSets)
    .innerJoin(exercises, eq(exercises.id, strengthSets.exerciseId))
    .innerJoin(workouts, eq(workouts.id, strengthSets.workoutId))
    .where(
      and(
        finishedWorkout,
        isNotNull(strengthSets.completedAt),
        eq(exercises.logType, 'weight_reps'),
      ),
    );
  return rows.filter(
    (row): row is LiftedSet => row.weightKg !== null && row.reps !== null && row.weightKg > 0,
  );
}

/** The heaviest weight ever lifted for one exercise, or 0. */
export async function heaviestLiftKg(exerciseId: string): Promise<number> {
  const rows = await db
    .select({ heaviest: max(strengthSets.weightKg) })
    .from(strengthSets)
    .innerJoin(workouts, eq(workouts.id, strengthSets.workoutId))
    .where(
      and(
        finishedWorkout,
        eq(strengthSets.exerciseId, exerciseId),
        isNotNull(strengthSets.completedAt),
      ),
    );
  return rows[0]?.heaviest ?? 0;
}

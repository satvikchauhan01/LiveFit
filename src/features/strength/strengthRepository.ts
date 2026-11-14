import * as Crypto from 'expo-crypto';
import { and, asc, desc, eq, isNotNull, isNull, ne, sql } from 'drizzle-orm';

import { notifyLocalChange } from '@/features/sync/changes';

import { db } from '@/db/client';
import { type Exercise, exercises, type StrengthSet, strengthSets, workouts } from '@/db/schema';

import { BUILT_IN_EXERCISES, type ExerciseDefinition } from './builtInExercises';

// --- Exercises ------------------------------------------------------------------

/**
 * Copies the built-in list into the database. "Upsert": rows that already exist
 * are updated (so a renamed exercise reaches existing installs); new ones are added.
 */
export async function seedBuiltInExercises(): Promise<void> {
  const now = Date.now();
  await db
    .insert(exercises)
    .values(
      BUILT_IN_EXERCISES.map((exercise) => ({ ...exercise, isCustom: false, createdAt: now })),
    )
    .onConflictDoUpdate({
      target: exercises.id,
      set: {
        // `excluded` is SQLite's name for the row that was about to be inserted.
        name: sql`excluded.name`,
        muscleGroup: sql`excluded.muscle_group`,
        equipment: sql`excluded.equipment`,
        logType: sql`excluded.log_type`,
      },
    });
}

export async function getExercise(id: string): Promise<Exercise | null> {
  const rows = await db.select().from(exercises).where(eq(exercises.id, id));
  return rows[0] ?? null;
}

export async function listExercises(): Promise<Exercise[]> {
  return db.select().from(exercises).orderBy(asc(exercises.name));
}

/** Case-insensitive lookup, to stop the same custom exercise being created twice. */
export async function findExerciseByName(name: string): Promise<Exercise | null> {
  const rows = await db
    .select()
    .from(exercises)
    .where(sql`lower(${exercises.name}) = ${name.trim().toLowerCase()}`)
    .limit(1);
  return rows[0] ?? null;
}

export async function createCustomExercise(
  input: Omit<ExerciseDefinition, 'id'>,
): Promise<Exercise> {
  const rows = await db
    .insert(exercises)
    .values({
      ...input,
      name: input.name.trim(),
      id: Crypto.randomUUID(),
      isCustom: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      dirty: true,
    })
    .returning();
  notifyLocalChange();
  return rows[0];
}

// --- Sets -------------------------------------------------------------------------

export type SetValues = Pick<StrengthSet, 'reps' | 'weightKg' | 'durationS'>;

export type NewSet = SetValues &
  Pick<StrengthSet, 'workoutId' | 'exerciseId' | 'exerciseOrder' | 'setIndex'> & {
    /** Already done (logged after the fact); new sets are open by default. */
    completedAt?: number | null;
  };

export async function insertSets(sets: NewSet[]): Promise<StrengthSet[]> {
  if (sets.length === 0) return [];
  return db
    .insert(strengthSets)
    .values(sets.map((set) => ({ ...set, completedAt: set.completedAt ?? null })))
    .returning();
}

export async function updateSet(
  id: number,
  changes: Partial<SetValues & Pick<StrengthSet, 'completedAt'>>,
): Promise<StrengthSet> {
  const rows = await db
    .update(strengthSets)
    .set(changes)
    .where(eq(strengthSets.id, id))
    .returning();
  return rows[0];
}

export async function deleteSet(id: number): Promise<void> {
  await db.delete(strengthSets).where(eq(strengthSets.id, id));
}

export async function deleteExerciseSets(workoutId: string, exerciseOrder: number): Promise<void> {
  await db
    .delete(strengthSets)
    .where(
      and(eq(strengthSets.workoutId, workoutId), eq(strengthSets.exerciseOrder, exerciseOrder)),
    );
}

/** Sets that were never ticked off aren't part of the finished workout. */
export async function deleteIncompleteSets(workoutId: string): Promise<void> {
  await db
    .delete(strengthSets)
    .where(and(eq(strengthSets.workoutId, workoutId), isNull(strengthSets.completedAt)));
}

/** One exercise in a session, with its sets in order. */
export type ExerciseLog = {
  order: number;
  exercise: Exercise;
  sets: StrengthSet[];
};

/** Every set of a workout with its exercise (a JOIN), grouped by exercise. */
export async function getExerciseLogs(workoutId: string): Promise<ExerciseLog[]> {
  const rows = await db
    .select({ set: strengthSets, exercise: exercises })
    .from(strengthSets)
    .innerJoin(exercises, eq(exercises.id, strengthSets.exerciseId))
    .where(eq(strengthSets.workoutId, workoutId))
    .orderBy(asc(strengthSets.exerciseOrder), asc(strengthSets.setIndex));

  const logs: ExerciseLog[] = [];
  for (const { set, exercise } of rows) {
    const current = logs[logs.length - 1];
    if (current && current.order === set.exerciseOrder) {
      current.sets.push(set);
    } else {
      logs.push({ order: set.exerciseOrder, exercise, sets: [set] });
    }
  }
  return logs;
}

/**
 * The completed sets from the most recent finished workout that included this
 * exercise: the "Last time: 3 × 8 @ 60 kg" hint, and the values new sets start with.
 */
export async function getLastSets(
  exerciseId: string,
  excludeWorkoutId: string,
): Promise<StrengthSet[]> {
  const latest = await db
    .select({ workoutId: strengthSets.workoutId })
    .from(strengthSets)
    .innerJoin(workouts, eq(workouts.id, strengthSets.workoutId))
    .where(
      and(
        eq(strengthSets.exerciseId, exerciseId),
        eq(workouts.status, 'finished'),
        isNull(workouts.deletedAt),
        ne(workouts.id, excludeWorkoutId),
        isNotNull(strengthSets.completedAt),
      ),
    )
    .orderBy(desc(workouts.startedAt))
    .limit(1);

  const workoutId = latest[0]?.workoutId;
  if (!workoutId) {
    return [];
  }
  return db
    .select()
    .from(strengthSets)
    .where(
      and(
        eq(strengthSets.workoutId, workoutId),
        eq(strengthSets.exerciseId, exerciseId),
        isNotNull(strengthSets.completedAt),
      ),
    )
    .orderBy(asc(strengthSets.exerciseOrder), asc(strengthSets.setIndex));
}

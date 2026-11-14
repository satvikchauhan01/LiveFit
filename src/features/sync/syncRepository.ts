import { and, eq, inArray, isNotNull, isNull } from 'drizzle-orm';

import type { PackedPoint, SyncDoc, WorkoutDoc } from '@shared/api';

import { db } from '@/db/client';
import {
  exercises,
  profile,
  strengthSets,
  syncState,
  type Workout,
  workoutLaps,
  workoutPauses,
  workouts,
} from '@/db/schema';
import { getExerciseLogs } from '@/features/strength/strengthRepository';
import {
  getLaps,
  getPauses,
  getTrackPoints,
  insertTrackPoints,
} from '@/features/workouts/workoutRepository';

// Everything the sync engine reads from and writes to the phone's database.

// --- Sync state (key/value) ---------------------------------------------------------

export async function readState(key: string): Promise<string | null> {
  const rows = await db.select().from(syncState).where(eq(syncState.key, key));
  return rows[0]?.value ?? null;
}

export async function writeState(key: string, value: string): Promise<void> {
  await db
    .insert(syncState)
    .values({ key, value })
    .onConflictDoUpdate({ target: syncState.key, set: { value } });
}

export async function clearState(): Promise<void> {
  await db.delete(syncState);
}

// --- Workouts -------------------------------------------------------------------------

function parseExtras(text: string): Record<string, unknown> {
  try {
    const value = JSON.parse(text) as unknown;
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Packs a workout and everything in it into the upload format. */
export async function toWorkoutDoc(workout: Workout): Promise<WorkoutDoc> {
  const [points, pauses, laps, logs] = await Promise.all([
    getTrackPoints(workout.id),
    getPauses(workout.id),
    getLaps(workout.id),
    workout.type === 'strength' ? getExerciseLogs(workout.id) : Promise.resolve([]),
  ]);
  return {
    id: workout.id,
    type: workout.type,
    source: workout.source,
    startedAt: workout.startedAt,
    endedAt: workout.endedAt,
    timezone: workout.timezone,
    elapsedS: workout.elapsedS,
    movingS: workout.movingS,
    distanceM: workout.distanceM,
    volumeKg: workout.volumeKg,
    elevationGainM: workout.elevationGainM,
    caloriesEst: workout.caloriesEst,
    autoPause: workout.autoPause,
    title: workout.title,
    notes: workout.notes,
    visibility: workout.visibility,
    extras: parseExtras(workout.extras),
    updatedAt: workout.updatedAt,
    detail: {
      points: points.map((p): PackedPoint => [
        p.t,
        p.lat,
        p.lng,
        p.alt,
        p.accuracy,
        p.speed,
        p.mocked ? 1 : 0,
      ]),
      pauses: pauses.map(({ startedAt, endedAt }) => ({ startedAt, endedAt })),
      laps: laps.map((lap) => lap.t),
      sets: logs.flatMap((log) =>
        log.sets.map((set) => ({
          exerciseId: set.exerciseId,
          exerciseOrder: set.exerciseOrder,
          setIndex: set.setIndex,
          reps: set.reps,
          weightKg: set.weightKg,
          durationS: set.durationS,
          completedAt: set.completedAt,
        })),
      ),
    },
  };
}

/** Finished workouts waiting to be uploaded (not deleted ones). */
export async function dirtyWorkouts(): Promise<Workout[]> {
  return db
    .select()
    .from(workouts)
    .where(
      and(eq(workouts.dirty, true), eq(workouts.status, 'finished'), isNull(workouts.deletedAt)),
    );
}

/** Deleted workouts the server hasn't heard about yet. */
export async function pendingDeletes(): Promise<{ id: string; deletedAt: number }[]> {
  const rows = await db
    .select({ id: workouts.id, deletedAt: workouts.deletedAt })
    .from(workouts)
    .where(isNotNull(workouts.deletedAt));
  return rows.map((row) => ({ id: row.id, deletedAt: row.deletedAt ?? Date.now() }));
}

/**
 * Clears the "needs upload" flag, but only if the workout hasn't been edited
 * again while the upload was on its way (its updatedAt is still the same).
 */
export async function markWorkoutUploaded(id: string, updatedAt: number): Promise<void> {
  await db
    .update(workouts)
    .set({ dirty: false })
    .where(and(eq(workouts.id, id), eq(workouts.updatedAt, updatedAt)));
}

/** Once the server knows about a delete, the tombstone can go. */
export async function purgeTombstones(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await db.delete(workouts).where(and(inArray(workouts.id, ids), isNotNull(workouts.deletedAt)));
}

export async function purgeAllTombstones(): Promise<void> {
  await db.delete(workouts).where(isNotNull(workouts.deletedAt));
}

/** Inserts a workout from another device, or takes newer edits to one we have. */
export async function applyWorkoutDoc(doc: WorkoutDoc): Promise<void> {
  const [local] = await db.select().from(workouts).where(eq(workouts.id, doc.id));

  if (local) {
    if (local.deletedAt !== null) return; // deleted here; our delete wins once pushed
    if (local.dirty && local.updatedAt >= doc.updatedAt) return; // our edit is newer
    if (doc.updatedAt <= local.updatedAt) return;
    await db
      .update(workouts)
      .set({
        title: doc.title,
        notes: doc.notes,
        visibility: doc.visibility,
        extras: JSON.stringify(doc.extras),
        updatedAt: doc.updatedAt,
        dirty: false,
      })
      .where(eq(workouts.id, doc.id));
    return;
  }

  await db.transaction(async (tx) => {
    await tx.insert(workouts).values({
      id: doc.id,
      type: doc.type as Workout['type'],
      source: doc.source as Workout['source'],
      status: 'finished',
      startedAt: doc.startedAt,
      endedAt: doc.endedAt,
      timezone: doc.timezone,
      elapsedS: doc.elapsedS,
      movingS: doc.movingS,
      distanceM: doc.distanceM,
      volumeKg: doc.volumeKg,
      elevationGainM: doc.elevationGainM,
      caloriesEst: doc.caloriesEst,
      autoPause: doc.autoPause,
      title: doc.title,
      notes: doc.notes,
      visibility: doc.visibility,
      extras: JSON.stringify(doc.extras),
      dirty: false,
      createdAt: Date.now(),
      updatedAt: doc.updatedAt,
    });
    if (doc.detail.pauses.length > 0) {
      await tx
        .insert(workoutPauses)
        .values(doc.detail.pauses.map((pause) => ({ workoutId: doc.id, ...pause })));
    }
    if (doc.detail.laps.length > 0) {
      await tx.insert(workoutLaps).values(doc.detail.laps.map((t) => ({ workoutId: doc.id, t })));
    }
    for (const set of doc.detail.sets) {
      // A custom exercise from another device may arrive after the workout using it.
      await tx
        .insert(exercises)
        .values({
          id: set.exerciseId,
          name: 'Exercise',
          muscleGroup: 'full_body',
          equipment: 'other',
          logType: set.durationS !== null ? 'time' : set.weightKg !== null ? 'weight_reps' : 'reps',
          isCustom: true,
          createdAt: Date.now(),
          updatedAt: 0,
        })
        .onConflictDoNothing();
      await tx.insert(strengthSets).values({ workoutId: doc.id, ...set });
    }
  });

  await insertTrackPoints(
    doc.id,
    doc.detail.points.map(([t, lat, lng, alt, accuracy, speed, mocked]) => ({
      t,
      lat,
      lng,
      alt,
      accuracy,
      speed,
      mocked: mocked === 1,
    })),
  );
}

export async function removeWorkoutsLocally(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  // ON DELETE CASCADE removes points, pauses, laps and sets.
  await db.delete(workouts).where(inArray(workouts.id, ids));
}

/** After signing in, everything on this phone goes up to the new account. */
export async function markEverythingForUpload(): Promise<void> {
  await db
    .update(workouts)
    .set({ dirty: true })
    .where(and(eq(workouts.status, 'finished'), isNull(workouts.deletedAt)));
  await db.update(profile).set({ dirty: true });
  await db.update(exercises).set({ dirty: true }).where(eq(exercises.isCustom, true));
}

export type { SyncDoc };

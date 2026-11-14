import * as Crypto from 'expo-crypto';
import { and, asc, desc, eq, gte, inArray, isNull, sql } from 'drizzle-orm';

import { db } from '@/db/client';
import {
  ACTIVITY_TYPES,
  type ActivityType,
  GPS_ACTIVITY_TYPES,
  strengthSets,
  trackPoints,
  type Workout,
  type WorkoutLap,
  workoutLaps,
  type WorkoutPause,
  workoutPauses,
  workouts,
} from '@/db/schema';
import { type ExerciseLog, getExerciseLogs } from '@/features/strength/strengthRepository';
import { notifyLocalChange } from '@/features/sync/changes';
import type { TrackPoint } from '@/features/tracking/types';
import { deviceTimeZone } from '@/lib/dates';

// --- Workouts ---------------------------------------------------------------

type Visibility = Workout['visibility'];
let defaultVisibility: () => Visibility = () => 'only_me';

/**
 * Who new workouts are shared with. The community settings plug in here; until
 * they have loaded (or when signed out), new workouts stay private.
 */
export function setDefaultVisibilityProvider(provider: () => Visibility): void {
  defaultVisibility = provider;
}

export async function createWorkout(input: {
  type: ActivityType;
  source: Workout['source'];
  startedAt: number;
  batteryStart: number | null;
  /** Runs and walks: whether auto-pause is on (it can't change mid-workout). */
  autoPause?: boolean;
}): Promise<Workout> {
  const now = Date.now();
  const rows = await db
    .insert(workouts)
    .values({
      // Made on the device, so the id stays the same after it's synced later.
      id: Crypto.randomUUID(),
      type: input.type,
      source: input.source,
      status: 'active',
      startedAt: input.startedAt,
      timezone: deviceTimeZone(),
      batteryStart: input.batteryStart,
      autoPause: input.autoPause ?? false,
      visibility: defaultVisibility(),
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return rows[0];
}

/**
 * Saves a workout that's already over: logged by hand, or imported from a GPX
 * file. It's marked for upload like any finished workout.
 */
export async function createFinishedWorkout(input: {
  type: ActivityType;
  source: Workout['source'];
  startedAt: number;
  endedAt: number;
  timezone?: string;
  elapsedS: number;
  movingS: number;
  distanceM: number | null;
  elevationGainM?: number | null;
  caloriesEst?: number | null;
  extras?: string;
  title: string;
  notes?: string;
}): Promise<Workout> {
  const now = Date.now();
  const rows = await db
    .insert(workouts)
    .values({
      id: Crypto.randomUUID(),
      status: 'finished',
      dirty: true,
      batteryStart: null,
      visibility: defaultVisibility(),
      createdAt: now,
      updatedAt: now,
      ...input,
      timezone: input.timezone ?? deviceTimeZone(),
    })
    .returning();
  notifyLocalChange();
  return rows[0];
}

function whereActive(types: readonly ActivityType[]) {
  return and(eq(workouts.status, 'active'), inArray(workouts.type, [...types]));
}

/** The workout in progress of one of these types, if any. Only one runs at a time. */
export async function getActiveWorkout(
  types: readonly ActivityType[] = ACTIVITY_TYPES,
): Promise<Workout | null> {
  const rows = await db
    .select()
    .from(workouts)
    .where(whereActive(types))
    .orderBy(desc(workouts.startedAt))
    .limit(1);
  return rows[0] ?? null;
}

/** The run or walk being recorded: where the background GPS task saves points. */
export async function getActiveGpsWorkoutId(): Promise<string | null> {
  const rows = await db
    .select({ id: workouts.id })
    .from(workouts)
    .where(whereActive(GPS_ACTIVITY_TYPES))
    .orderBy(desc(workouts.startedAt))
    .limit(1);
  return rows[0]?.id ?? null;
}

/** A workout that hasn't been deleted. */
export async function getWorkout(id: string): Promise<Workout | null> {
  const rows = await db
    .select()
    .from(workouts)
    .where(and(eq(workouts.id, id), isNull(workouts.deletedAt)));
  return rows[0] ?? null;
}

/** What History and Home need: finished workouts, filtered by activity and start date. */
export type WorkoutFilter = {
  /** Only these activities; all of them when left out. */
  types?: ActivityType[];
  /** Only workouts that started at or after this time (Unix ms). */
  fromMs?: number;
};

function whereFinished(filter: WorkoutFilter) {
  const conditions = [eq(workouts.status, 'finished'), isNull(workouts.deletedAt)];
  if (filter.types && filter.types.length > 0) {
    conditions.push(inArray(workouts.type, filter.types));
  }
  if (filter.fromMs !== undefined) {
    conditions.push(gte(workouts.startedAt, filter.fromMs));
  }
  return and(...conditions);
}

/** The columns a list row needs; leaving out the rest keeps big lists light. */
const listColumns = {
  id: workouts.id,
  type: workouts.type,
  title: workouts.title,
  startedAt: workouts.startedAt,
  timezone: workouts.timezone,
  distanceM: workouts.distanceM,
  movingS: workouts.movingS,
  volumeKg: workouts.volumeKg,
  elevationGainM: workouts.elevationGainM,
  caloriesEst: workouts.caloriesEst,
  extras: workouts.extras,
};

export type WorkoutListItem = Pick<Workout, keyof typeof listColumns>;

/** Finished workouts, newest first. */
export async function listWorkouts(
  filter: WorkoutFilter = {},
  limit?: number,
): Promise<WorkoutListItem[]> {
  const query = db
    .select(listColumns)
    .from(workouts)
    .where(whereFinished(filter))
    .orderBy(desc(workouts.startedAt));
  return limit !== undefined ? query.limit(limit) : query;
}

export type WorkoutSummaryFields = Pick<
  Workout,
  'endedAt' | 'elapsedS' | 'movingS' | 'distanceM' | 'volumeKg' | 'title' | 'batteryEnd'
> &
  Partial<Pick<Workout, 'elevationGainM' | 'caloriesEst' | 'extras'>>;

export async function finishWorkout(id: string, summary: WorkoutSummaryFields): Promise<Workout> {
  const rows = await db
    .update(workouts)
    // `dirty` marks it for upload at the next sync.
    .set({ ...summary, status: 'finished', dirty: true, updatedAt: Date.now() })
    .where(eq(workouts.id, id))
    .returning();
  notifyLocalChange();
  return rows[0];
}

export async function updateWorkoutDetails(
  id: string,
  details: Partial<Pick<Workout, 'title' | 'notes' | 'visibility'>>,
): Promise<void> {
  await db
    .update(workouts)
    .set({ ...details, dirty: true, updatedAt: Date.now() })
    .where(eq(workouts.id, id));
  notifyLocalChange();
}

/**
 * Deletes a finished workout. The route and sets go at once; a small
 * "tombstone" row stays until the server has been told, so the delete reaches
 * your other devices too.
 */
export async function deleteWorkout(id: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(trackPoints).where(eq(trackPoints.workoutId, id));
    await tx.delete(workoutPauses).where(eq(workoutPauses.workoutId, id));
    await tx.delete(workoutLaps).where(eq(workoutLaps.workoutId, id));
    await tx.delete(strengthSets).where(eq(strengthSets.workoutId, id));
    await tx
      .update(workouts)
      .set({ deletedAt: Date.now(), dirty: true, updatedAt: Date.now() })
      .where(eq(workouts.id, id));
  });
  notifyLocalChange();
}

/**
 * Removes a workout and everything in it for good, e.g. discarding one that's
 * still in progress (it was never uploaded, so there's nothing to tell the server).
 */
export async function removeWorkoutPermanently(id: string): Promise<void> {
  // Track points, pauses, laps and strength sets go too, thanks to ON DELETE CASCADE.
  await db.delete(workouts).where(eq(workouts.id, id));
}

export type Totals = { count: number; distanceM: number; movingS: number };

/**
 * Count, distance and time of the matching workouts, added up by SQLite
 * (an aggregate query) instead of loading every row into JavaScript.
 */
export async function getTotals(filter: WorkoutFilter = {}): Promise<Totals> {
  const rows = await db
    .select({
      count: sql<number>`count(*)`,
      // SUM of no rows is NULL, so fall back to 0.
      distanceM: sql<number>`coalesce(sum(${workouts.distanceM}), 0)`,
      movingS: sql<number>`coalesce(sum(${workouts.movingS}), 0)`,
    })
    .from(workouts)
    .where(whereFinished(filter));
  return rows[0] ?? { count: 0, distanceM: 0, movingS: 0 };
}

// --- Track points -------------------------------------------------------------

// 8 values per point × 100 points stays well under SQLite's limit of 999 values per statement.
const INSERT_CHUNK_SIZE = 100;

export async function insertTrackPoints(workoutId: string, points: TrackPoint[]): Promise<void> {
  for (let start = 0; start < points.length; start += INSERT_CHUNK_SIZE) {
    const chunk = points.slice(start, start + INSERT_CHUNK_SIZE);
    await db.insert(trackPoints).values(
      chunk.map((p) => ({
        workoutId,
        t: p.t,
        lat: p.lat,
        lng: p.lng,
        alt: p.alt,
        accuracyM: p.accuracy,
        speedMps: p.speed,
        mocked: p.mocked,
      })),
    );
  }
}

export async function getTrackPoints(workoutId: string): Promise<TrackPoint[]> {
  const rows = await db
    .select()
    .from(trackPoints)
    .where(eq(trackPoints.workoutId, workoutId))
    .orderBy(asc(trackPoints.t), asc(trackPoints.id));
  return rows.map((row) => ({
    t: row.t,
    lat: row.lat,
    lng: row.lng,
    alt: row.alt,
    accuracy: row.accuracyM,
    speed: row.speedMps,
    mocked: row.mocked,
  }));
}

// --- Pauses -------------------------------------------------------------------

export async function getPauses(workoutId: string): Promise<WorkoutPause[]> {
  return db
    .select()
    .from(workoutPauses)
    .where(eq(workoutPauses.workoutId, workoutId))
    .orderBy(asc(workoutPauses.startedAt));
}

export async function insertPauses(
  workoutId: string,
  pauses: { startedAt: number; endedAt: number | null }[],
): Promise<void> {
  if (pauses.length === 0) return;
  await db.insert(workoutPauses).values(pauses.map((pause) => ({ workoutId, ...pause })));
}

export async function startPause(workoutId: string, at: number): Promise<WorkoutPause> {
  const rows = await db.insert(workoutPauses).values({ workoutId, startedAt: at }).returning();
  return rows[0];
}

export async function endPause(pauseId: number, at: number): Promise<void> {
  await db.update(workoutPauses).set({ endedAt: at }).where(eq(workoutPauses.id, pauseId));
}

export async function deletePause(pauseId: number): Promise<void> {
  await db.delete(workoutPauses).where(eq(workoutPauses.id, pauseId));
}

// --- Laps -------------------------------------------------------------------------

export async function getLaps(workoutId: string): Promise<WorkoutLap[]> {
  return db
    .select()
    .from(workoutLaps)
    .where(eq(workoutLaps.workoutId, workoutId))
    .orderBy(asc(workoutLaps.t));
}

export async function insertLap(workoutId: string, t: number): Promise<WorkoutLap> {
  const rows = await db.insert(workoutLaps).values({ workoutId, t }).returning();
  return rows[0];
}

export type WorkoutDetail = {
  workout: Workout;
  /** Runs and walks: the route. Empty for strength. */
  points: TrackPoint[];
  pauses: WorkoutPause[];
  /** Runs and walks: manual lap presses. */
  laps: WorkoutLap[];
  /** Strength: exercises and sets. Empty for runs and walks. */
  exercises: ExerciseLog[];
};

/** Everything needed to show one workout. */
export async function loadWorkoutDetail(id: string): Promise<WorkoutDetail | null> {
  const workout = await getWorkout(id);
  if (!workout) {
    return null;
  }
  if (workout.type === 'strength') {
    return { workout, points: [], pauses: [], laps: [], exercises: await getExerciseLogs(id) };
  }
  const [points, pauses, laps] = await Promise.all([
    getTrackPoints(id),
    getPauses(id),
    getLaps(id),
  ]);
  return { workout, points, pauses, laps, exercises: [] };
}

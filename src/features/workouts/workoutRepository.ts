import * as Crypto from 'expo-crypto';
import { and, asc, desc, eq, gte, inArray, sql } from 'drizzle-orm';

import { db } from '@/db/client';
import {
  ACTIVITY_TYPES,
  type ActivityType,
  GPS_ACTIVITY_TYPES,
  trackPoints,
  type Workout,
  type WorkoutLap,
  workoutLaps,
  type WorkoutPause,
  workoutPauses,
  workouts,
} from '@/db/schema';
import { type ExerciseLog, getExerciseLogs } from '@/features/strength/strengthRepository';
import type { TrackPoint } from '@/features/tracking/types';
import { deviceTimeZone } from '@/lib/dates';

// --- Workouts ---------------------------------------------------------------

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
      createdAt: now,
      updatedAt: now,
    })
    .returning();
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

export async function getWorkout(id: string): Promise<Workout | null> {
  const rows = await db.select().from(workouts).where(eq(workouts.id, id));
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
  const conditions = [eq(workouts.status, 'finished')];
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
>;

export async function finishWorkout(id: string, summary: WorkoutSummaryFields): Promise<Workout> {
  const rows = await db
    .update(workouts)
    .set({ ...summary, status: 'finished', updatedAt: Date.now() })
    .where(eq(workouts.id, id))
    .returning();
  return rows[0];
}

export async function updateWorkoutDetails(
  id: string,
  details: Pick<Workout, 'title' | 'notes'>,
): Promise<void> {
  await db
    .update(workouts)
    .set({ ...details, updatedAt: Date.now() })
    .where(eq(workouts.id, id));
}

export async function deleteWorkout(id: string): Promise<void> {
  // Track points, pauses and strength sets go too, thanks to ON DELETE CASCADE.
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

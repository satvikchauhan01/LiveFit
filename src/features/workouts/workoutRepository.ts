import * as Crypto from 'expo-crypto';
import { and, asc, desc, eq, gte, sql } from 'drizzle-orm';

import { db } from '@/db/client';
import {
  type ActivityType,
  trackPoints,
  type Workout,
  type WorkoutPause,
  workoutPauses,
  workouts,
} from '@/db/schema';
import type { TrackPoint } from '@/features/tracking/types';

function currentTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
  } catch {
    return 'UTC';
  }
}

// --- Workouts ---------------------------------------------------------------

export async function createWorkout(input: {
  type: ActivityType;
  startedAt: number;
  batteryStart: number | null;
}): Promise<Workout> {
  const now = Date.now();
  const rows = await db
    .insert(workouts)
    .values({
      // Made on the device, so the id stays the same after it's synced later.
      id: Crypto.randomUUID(),
      type: input.type,
      status: 'active',
      startedAt: input.startedAt,
      timezone: currentTimeZone(),
      batteryStart: input.batteryStart,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return rows[0];
}

/** The workout being recorded, if any. There is at most one. */
export async function getActiveWorkout(): Promise<Workout | null> {
  const rows = await db
    .select()
    .from(workouts)
    .where(eq(workouts.status, 'active'))
    .orderBy(desc(workouts.startedAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function getActiveWorkoutId(): Promise<string | null> {
  const rows = await db
    .select({ id: workouts.id })
    .from(workouts)
    .where(eq(workouts.status, 'active'))
    .orderBy(desc(workouts.startedAt))
    .limit(1);
  return rows[0]?.id ?? null;
}

export async function getWorkout(id: string): Promise<Workout | null> {
  const rows = await db.select().from(workouts).where(eq(workouts.id, id));
  return rows[0] ?? null;
}

/** Finished workouts, newest first. */
export async function listFinishedWorkouts(limit?: number): Promise<Workout[]> {
  const query = db
    .select()
    .from(workouts)
    .where(eq(workouts.status, 'finished'))
    .orderBy(desc(workouts.startedAt));
  return limit !== undefined ? query.limit(limit) : query;
}

export type WorkoutSummaryFields = Pick<
  Workout,
  'endedAt' | 'elapsedS' | 'movingS' | 'distanceM' | 'title' | 'batteryEnd'
>;

export async function finishWorkout(id: string, summary: WorkoutSummaryFields): Promise<Workout> {
  const rows = await db
    .update(workouts)
    .set({ ...summary, status: 'finished', updatedAt: Date.now() })
    .where(eq(workouts.id, id))
    .returning();
  return rows[0];
}

export async function updateWorkoutTitle(id: string, title: string): Promise<void> {
  await db.update(workouts).set({ title, updatedAt: Date.now() }).where(eq(workouts.id, id));
}

export async function deleteWorkout(id: string): Promise<void> {
  // Track points and pauses go too, thanks to ON DELETE CASCADE.
  await db.delete(workouts).where(eq(workouts.id, id));
}

export type Totals = { count: number; distanceM: number; movingS: number };

/** Count, distance and time of finished workouts that started at or after `fromMs`. */
export async function getTotalsSince(fromMs: number): Promise<Totals> {
  const rows = await db
    .select({
      count: sql<number>`count(*)`,
      distanceM: sql<number>`coalesce(sum(${workouts.distanceM}), 0)`,
      movingS: sql<number>`coalesce(sum(${workouts.movingS}), 0)`,
    })
    .from(workouts)
    .where(and(eq(workouts.status, 'finished'), gte(workouts.startedAt, fromMs)));
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

/** Everything needed to show one workout. */
export async function loadWorkoutDetail(id: string) {
  const workout = await getWorkout(id);
  if (!workout) {
    return null;
  }
  const [points, pauses] = await Promise.all([getTrackPoints(id), getPauses(id)]);
  return { workout, points, pauses };
}

export type WorkoutDetail = NonNullable<Awaited<ReturnType<typeof loadWorkoutDetail>>>;

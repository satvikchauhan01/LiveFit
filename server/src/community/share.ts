import { and, eq, isNull } from 'drizzle-orm';

import { db } from '../db/client';
import { privacyZones, socialSettings, type Workout, workoutShares, workouts } from '../db/schema';
import { onWorkoutSavedListener } from '../sync/hooks';
import { distanceM, type LatLng, simplify, trimEnds } from './geo';
import { verifyWorkout } from './verify';

const TRIM_ENDS_M = 200;
const MAX_ACCURACY_M = 25;

export async function getSocialSettings(userId: string) {
  const [row] = await db.select().from(socialSettings).where(eq(socialSettings.userId, userId));
  if (row) return row;
  const [created] = await db
    .insert(socialSettings)
    .values({ userId })
    .onConflictDoNothing()
    .returning();
  return created ?? (await db.select().from(socialSettings).where(eq(socialSettings.userId, userId)))[0];
}

/**
 * The version of a route other people may see. This runs on the server, so the
 * cut parts never leave it: points inside privacy zones are removed (splitting
 * the route there), the first and last 200 m are dropped if asked, and what's
 * left is simplified.
 */
export async function shareableRoute(workout: Workout): Promise<LatLng[] | null> {
  const settings = await getSocialSettings(workout.userId);
  if (settings.hideMaps) return null;
  const zones = await db.select().from(privacyZones).where(eq(privacyZones.userId, workout.userId));

  let route: LatLng[] = workout.detail.points
    .filter((point) => point[4] === null || point[4] <= MAX_ACCURACY_M)
    .map((point) => [point[1], point[2]]);
  if (settings.trimRouteEnds) route = trimEnds(route, TRIM_ENDS_M);
  route = route.filter(
    (point) => !zones.some((zone) => distanceM(point, [zone.lat, zone.lng]) <= zone.radiusM),
  );
  if (route.length < 2) return null;
  return simplify(route).map(([lat, lng]) => [
    Math.round(lat * 1e5) / 1e5,
    Math.round(lng * 1e5) / 1e5,
  ]);
}

/** Recomputes what others see of a workout, and whether it passes the fair-play checks. */
export async function updateWorkoutShare(workout: Workout): Promise<void> {
  const route = await shareableRoute(workout);
  const verification = verifyWorkout(workout);
  await db
    .insert(workoutShares)
    .values({
      workoutId: workout.id,
      route,
      verified: verification.verified,
      flags: verification.flags,
      serverDistanceM: verification.serverDistanceM,
    })
    .onConflictDoUpdate({
      target: workoutShares.workoutId,
      set: {
        route,
        verified: verification.verified,
        flags: verification.flags,
        serverDistanceM: verification.serverDistanceM,
      },
    });
}

/** After privacy zones or route settings change, every shared route is redone. */
export async function refreshAllShares(userId: string): Promise<void> {
  const all = await db
    .select()
    .from(workouts)
    .where(and(eq(workouts.userId, userId), isNull(workouts.deletedAt)));
  for (const workout of all) {
    await updateWorkoutShare(workout);
  }
}

onWorkoutSavedListener(updateWorkoutShare);

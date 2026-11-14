import { and, desc, eq, inArray, lt, or, sql, type SQL } from 'drizzle-orm';

import type { SharedWorkout } from '../../../shared/api';
import { db } from '../db/client';
import { socialSettings, users, workoutShares, workouts } from '../db/schema';
import { canSeeWorkout, toPublicUser } from './relations';

/**
 * Loads workouts as other people see them: owner, summary numbers, the
 * privacy-trimmed route, kudos and comment counts. `where` narrows the set;
 * visibility rules are always applied on top.
 */
export async function loadSharedWorkouts(
  viewerId: string,
  where: SQL | undefined,
  options: { limit: number; before?: { startedAt: number; id: string } } = { limit: 20 },
): Promise<SharedWorkout[]> {
  const cursor = options.before
    ? or(
        lt(workouts.startedAt, options.before.startedAt),
        and(eq(workouts.startedAt, options.before.startedAt), lt(workouts.id, options.before.id)),
      )
    : undefined;

  const rows = await db
    .select({
      workout: {
        id: workouts.id,
        userId: workouts.userId,
        type: workouts.type,
        title: workouts.title,
        startedAt: workouts.startedAt,
        timezone: workouts.timezone,
        movingS: workouts.movingS,
        distanceM: workouts.distanceM,
        volumeKg: workouts.volumeKg,
        elevationGainM: workouts.elevationGainM,
        visibility: workouts.visibility,
      },
      owner: { id: users.id, username: users.username, displayName: users.displayName },
      route: workoutShares.route,
      verified: workoutShares.verified,
      hideStartTime: socialSettings.hideStartTime,
      kudos: sql<number>`(select count(*)::int from kudos k where k.workout_id = ${workouts.id})`,
      hasKudoed: sql<boolean>`exists (select 1 from kudos k where k.workout_id = ${workouts.id} and k.user_id = ${viewerId})`,
      comments: sql<number>`(select count(*)::int from comments c where c.workout_id = ${workouts.id} and not c.hidden)`,
    })
    .from(workouts)
    .innerJoin(users, eq(users.id, workouts.userId))
    .leftJoin(workoutShares, eq(workoutShares.workoutId, workouts.id))
    .leftJoin(socialSettings, eq(socialSettings.userId, workouts.userId))
    .where(and(canSeeWorkout(viewerId), sql`${users.suspendedAt} is null`, where, cursor))
    .orderBy(desc(workouts.startedAt), desc(workouts.id))
    .limit(options.limit);

  return rows.map((row) => ({
    id: row.workout.id,
    owner: toPublicUser(row.owner),
    type: row.workout.type,
    title: row.workout.title,
    startedAt: row.workout.startedAt,
    showTime: !(row.hideStartTime ?? false) || row.workout.userId === viewerId,
    timezone: row.workout.timezone,
    movingS: row.workout.movingS,
    distanceM: row.workout.distanceM,
    volumeKg: row.workout.volumeKg,
    elevationGainM: row.workout.elevationGainM,
    route: row.route ?? null,
    visibility: row.workout.visibility,
    kudos: row.kudos,
    hasKudoed: row.hasKudoed,
    comments: row.comments,
    verified: row.verified ?? false,
  }));
}

export async function loadSharedWorkout(viewerId: string, id: string) {
  const [item] = await loadSharedWorkouts(viewerId, inArray(workouts.id, [id]), { limit: 1 });
  return item ?? null;
}

import { and, eq, or, sql } from 'drizzle-orm';

import type { FollowState, PublicUser } from '../../../shared/api';
import { db } from '../db/client';
import { blocks, follows, type User, users, workouts } from '../db/schema';
import { forbidden, notFound } from '../lib/http';

export function toPublicUser(user: Pick<User, 'id' | 'username' | 'displayName'>): PublicUser {
  return { id: user.id, username: user.username ?? '', displayName: user.displayName };
}

/** True if either person has blocked the other. */
export async function blockedEitherWay(a: string, b: string): Promise<boolean> {
  const rows = await db
    .select({ blockerId: blocks.blockerId })
    .from(blocks)
    .where(
      or(
        and(eq(blocks.blockerId, a), eq(blocks.blockedId, b)),
        and(eq(blocks.blockerId, b), eq(blocks.blockedId, a)),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

export async function followState(followerId: string, followeeId: string): Promise<FollowState> {
  const [row] = await db
    .select({ status: follows.status })
    .from(follows)
    .where(and(eq(follows.followerId, followerId), eq(follows.followeeId, followeeId)));
  if (!row) return 'none';
  return row.status === 'accepted' ? 'following' : 'pending';
}

/** A community member by id, refusing suspended or blocked accounts. */
export async function findVisibleUser(viewerId: string, userId: string): Promise<User> {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user || !user.username || user.suspendedAt) throw notFound('This person isn’t on LiveFit.');
  if (await blockedEitherWay(viewerId, userId)) throw notFound('This person isn’t on LiveFit.');
  return user;
}

/** Community features need a username first. */
export function requireUsername(user: User): void {
  if (!user.username) throw forbidden('Choose a username first.', 'username_required');
}

// --- Who can see a workout ------------------------------------------------------------
//
// Only me    → just the owner.
// Followers  → people whose follow the owner accepted.
// Club       → followers, plus people in a club with the owner.
// Public     → anyone, unless the owner's profile is private (then followers only).
// Blocking hides everything both ways, whatever the setting.

const notBlocked = (viewerId: string) => sql`not exists (
  select 1 from blocks b
  where (b.blocker_id = ${workouts.userId} and b.blocked_id = ${viewerId})
     or (b.blocker_id = ${viewerId} and b.blocked_id = ${workouts.userId}))`;

export const viewerFollowsOwner = (viewerId: string) => sql`exists (
  select 1 from follows f
  where f.follower_id = ${viewerId} and f.followee_id = ${workouts.userId} and f.status = 'accepted')`;

export const viewerSharesClub = (viewerId: string) => sql`exists (
  select 1 from club_members mine
  join club_members theirs on theirs.club_id = mine.club_id
  where mine.user_id = ${viewerId} and theirs.user_id = ${workouts.userId})`;

const ownerIsPublic = sql`exists (
  select 1 from users owner where owner.id = ${workouts.userId} and owner.is_private = false)`;

/** SQL condition: the viewer may see this workout. */
export function canSeeWorkout(viewerId: string) {
  return sql`(
    ${workouts.deletedAt} is null
    and not exists (select 1 from workout_shares s where s.workout_id = ${workouts.id} and s.hidden)
    and (
      ${workouts.userId} = ${viewerId}
      or (
        ${notBlocked(viewerId)}
        and (
          (${workouts.visibility} = 'public' and (${ownerIsPublic} or ${viewerFollowsOwner(viewerId)}))
          or (${workouts.visibility} = 'followers' and ${viewerFollowsOwner(viewerId)})
          or (${workouts.visibility} = 'club' and (${viewerFollowsOwner(viewerId)} or ${viewerSharesClub(viewerId)}))
        )
      )
    )
  )`;
}

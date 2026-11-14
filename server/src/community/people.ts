import { and, asc, eq, ilike, ne, or, sql } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';

import type { PrivacyZone, PublicProfile, SocialSettingsDoc } from '../../../shared/api';
import { currentUser, requireAuth } from '../auth/middleware';
import { toApiUser } from '../auth/users';
import { db } from '../db/client';
import { blocks, follows, privacyZones, socialSettings, users, workouts } from '../db/schema';
import { HttpError, notFound, parse } from '../lib/http';
import { assertClean, normaliseUsername } from './filter';
import { notify } from './notify';
import {
  blockedEitherWay,
  findVisibleUser,
  followState,
  requireUsername,
  toPublicUser,
} from './relations';
import { getSocialSettings, refreshAllShares } from './share';
import { loadSharedWorkouts } from './sharedWorkouts';

export const peopleRouter = Router();
peopleRouter.use(requireAuth);

// --- Your community profile and settings -------------------------------------------------

peopleRouter.put('/me/username', async (req, res) => {
  const user = currentUser(req);
  const username = normaliseUsername(parse(z.object({ username: z.string() }), req.body).username);
  const [taken] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.username, username), ne(users.id, user.id)));
  if (taken) throw new HttpError(409, 'username_taken', 'That username is taken. Try another.');
  const [updated] = await db.update(users).set({ username }).where(eq(users.id, user.id)).returning();
  res.json({ user: toApiUser(updated) });
});

peopleRouter.patch('/me/profile', async (req, res) => {
  const user = currentUser(req);
  const body = parse(
    z.object({
      displayName: z.string().trim().max(40).optional(),
      bio: z.string().trim().max(200).optional(),
      isPrivate: z.boolean().optional(),
    }),
    req.body,
  );
  if (body.displayName) assertClean(body.displayName, 'name');
  if (body.bio) assertClean(body.bio, 'bio');
  const [updated] = await db.update(users).set(body).where(eq(users.id, user.id)).returning();
  // Going public auto-accepts anyone waiting.
  if (body.isPrivate === false) {
    await db
      .update(follows)
      .set({ status: 'accepted' })
      .where(and(eq(follows.followeeId, user.id), eq(follows.status, 'pending')));
  }
  res.json({ user: toApiUser(updated) });
});

function toSettingsDoc(row: Awaited<ReturnType<typeof getSocialSettings>>): SocialSettingsDoc {
  return {
    trimRouteEnds: row.trimRouteEnds,
    hideMaps: row.hideMaps,
    hideStartTime: row.hideStartTime,
    defaultVisibility: row.defaultVisibility,
    notifyFollows: row.notifyFollows,
    notifyKudos: row.notifyKudos,
    notifyComments: row.notifyComments,
    notifyClubs: row.notifyClubs,
    notifyChallenges: row.notifyChallenges,
    quietStart: row.quietStart,
    quietEnd: row.quietEnd,
  };
}

peopleRouter.get('/me/social-settings', async (req, res) => {
  res.json(toSettingsDoc(await getSocialSettings(currentUser(req).id)));
});

peopleRouter.patch('/me/social-settings', async (req, res) => {
  const user = currentUser(req);
  const body = parse(
    z.object({
      trimRouteEnds: z.boolean().optional(),
      hideMaps: z.boolean().optional(),
      hideStartTime: z.boolean().optional(),
      defaultVisibility: z.enum(['only_me', 'followers', 'club', 'public']).optional(),
      notifyFollows: z.boolean().optional(),
      notifyKudos: z.boolean().optional(),
      notifyComments: z.boolean().optional(),
      notifyClubs: z.boolean().optional(),
      notifyChallenges: z.boolean().optional(),
      quietStart: z.number().int().min(0).max(1439).nullable().optional(),
      quietEnd: z.number().int().min(0).max(1439).nullable().optional(),
      timezone: z.string().max(64).optional(),
    }),
    req.body,
  );
  await getSocialSettings(user.id);
  const [row] = await db
    .update(socialSettings)
    .set(body)
    .where(eq(socialSettings.userId, user.id))
    .returning();
  if (body.trimRouteEnds !== undefined || body.hideMaps !== undefined) {
    await refreshAllShares(user.id);
  }
  res.json(toSettingsDoc(row));
});

peopleRouter.get('/me/privacy-zones', async (req, res) => {
  const zones = await db
    .select()
    .from(privacyZones)
    .where(eq(privacyZones.userId, currentUser(req).id));
  res.json({
    zones: zones.map(
      (zone): PrivacyZone => ({ id: zone.id, lat: zone.lat, lng: zone.lng, radiusM: zone.radiusM }),
    ),
  });
});

peopleRouter.post('/me/privacy-zones', async (req, res) => {
  const user = currentUser(req);
  const body = parse(
    z.object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
      radiusM: z.number().int().min(100).max(2000),
    }),
    req.body,
  );
  const [zone] = await db
    .insert(privacyZones)
    .values({ userId: user.id, ...body })
    .returning();
  await refreshAllShares(user.id);
  res.status(201).json({ id: zone.id, lat: zone.lat, lng: zone.lng, radiusM: zone.radiusM });
});

peopleRouter.delete('/me/privacy-zones/:id', async (req, res) => {
  const user = currentUser(req);
  await db
    .delete(privacyZones)
    .where(and(eq(privacyZones.id, String(req.params.id)), eq(privacyZones.userId, user.id)));
  await refreshAllShares(user.id);
  res.status(204).end();
});

// --- People -----------------------------------------------------------------------------

async function profileFor(viewerId: string, userId: string): Promise<PublicProfile> {
  const user = await findVisibleUser(viewerId, userId);
  const isMe = viewerId === userId;
  const [state, reverse] = await Promise.all([
    followState(viewerId, userId),
    followState(userId, viewerId),
  ]);
  const [counts] = await db
    .select({
      followers: sql<number>`(select count(*)::int from follows where followee_id = ${userId} and status = 'accepted')`,
      following: sql<number>`(select count(*)::int from follows where follower_id = ${userId} and status = 'accepted')`,
    })
    .from(users)
    .where(eq(users.id, userId));
  return {
    ...toPublicUser(user),
    bio: user.bio,
    isPrivate: user.isPrivate,
    followState: state,
    followsYou: reverse === 'following',
    followers: counts?.followers ?? 0,
    following: counts?.following ?? 0,
    canSeeWorkouts: isMe || !user.isPrivate || state === 'following',
    isMe,
    blocked: false,
  };
}

peopleRouter.get('/users/search', async (req, res) => {
  const me = currentUser(req);
  const { query } = parse(z.object({ query: z.string().trim().min(2).max(40) }), req.query);
  const pattern = `${query.replace(/[%_]/g, '')}%`;
  const rows = await db
    .select({ id: users.id, username: users.username, displayName: users.displayName })
    .from(users)
    .where(
      and(
        sql`${users.username} is not null`,
        sql`${users.suspendedAt} is null`,
        ne(users.id, me.id),
        or(ilike(users.username, pattern), ilike(users.displayName, pattern)),
        sql`not exists (select 1 from blocks b where (b.blocker_id = ${users.id} and b.blocked_id = ${me.id}) or (b.blocker_id = ${me.id} and b.blocked_id = ${users.id}))`,
      ),
    )
    .orderBy(asc(users.username))
    .limit(20);
  res.json({ users: rows.map(toPublicUser) });
});

peopleRouter.get('/users/by-username/:username', async (req, res) => {
  const me = currentUser(req);
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, String(req.params.username).toLowerCase()));
  if (!user) throw notFound('No one has that username.');
  res.json(await profileFor(me.id, user.id));
});

peopleRouter.get('/users/:id', async (req, res) => {
  res.json(await profileFor(currentUser(req).id, String(req.params.id)));
});

peopleRouter.get('/users/:id/workouts', async (req, res) => {
  const me = currentUser(req);
  const profile = await profileFor(me.id, String(req.params.id));
  if (!profile.canSeeWorkouts) {
    res.json({ items: [], nextCursor: null });
    return;
  }
  const items = await loadSharedWorkouts(me.id, eq(workouts.userId, profile.id), { limit: 20 });
  res.json({ items, nextCursor: null });
});

peopleRouter.post('/users/:id/follow', async (req, res) => {
  const me = currentUser(req);
  requireUsername(me);
  const target = await findVisibleUser(me.id, String(req.params.id));
  if (target.id === me.id) throw new HttpError(400, 'bad_request', 'You can’t follow yourself.');
  const status = target.isPrivate ? 'pending' : 'accepted';
  const inserted = await db
    .insert(follows)
    .values({ followerId: me.id, followeeId: target.id, status })
    .onConflictDoNothing()
    .returning();
  if (inserted.length > 0) {
    await notify({
      userId: target.id,
      type: status === 'pending' ? 'follow_request' : 'follow',
      actorId: me.id,
    });
  }
  res.json(await profileFor(me.id, target.id));
});

peopleRouter.delete('/users/:id/follow', async (req, res) => {
  const me = currentUser(req);
  await db
    .delete(follows)
    .where(and(eq(follows.followerId, me.id), eq(follows.followeeId, String(req.params.id))));
  res.status(204).end();
});

/** Removes someone from your followers. */
peopleRouter.delete('/users/:id/follower', async (req, res) => {
  const me = currentUser(req);
  await db
    .delete(follows)
    .where(and(eq(follows.followerId, String(req.params.id)), eq(follows.followeeId, me.id)));
  res.status(204).end();
});

peopleRouter.get('/me/follow-requests', async (req, res) => {
  const me = currentUser(req);
  const rows = await db
    .select({ id: users.id, username: users.username, displayName: users.displayName })
    .from(follows)
    .innerJoin(users, eq(users.id, follows.followerId))
    .where(and(eq(follows.followeeId, me.id), eq(follows.status, 'pending')));
  res.json({ users: rows.map(toPublicUser) });
});

peopleRouter.post('/me/follow-requests/:id/:decision', async (req, res) => {
  const me = currentUser(req);
  const followerId = String(req.params.id);
  const decision = String(req.params.decision);
  const where = and(
    eq(follows.followerId, followerId),
    eq(follows.followeeId, me.id),
    eq(follows.status, 'pending'),
  );
  if (decision === 'accept') {
    const updated = await db.update(follows).set({ status: 'accepted' }).where(where).returning();
    if (updated.length > 0) {
      await notify({ userId: followerId, type: 'follow_accepted', actorId: me.id });
    }
  } else {
    await db.delete(follows).where(where);
  }
  res.status(204).end();
});

async function followList(
  req: Parameters<Parameters<typeof peopleRouter.get>[1]>[0],
  res: Parameters<Parameters<typeof peopleRouter.get>[1]>[1],
  followersList: boolean,
) {
  const me = currentUser(req);
  const profile = await profileFor(me.id, String(req.params.id));
  if (!profile.canSeeWorkouts) {
    res.json({ users: [] });
    return;
  }
  const rows = await db
    .select({ id: users.id, username: users.username, displayName: users.displayName })
    .from(follows)
    .innerJoin(users, eq(users.id, followersList ? follows.followerId : follows.followeeId))
    .where(
      and(
        eq(followersList ? follows.followeeId : follows.followerId, profile.id),
        eq(follows.status, 'accepted'),
        sql`${users.suspendedAt} is null`,
      ),
    )
    .limit(200);
  res.json({ users: rows.map(toPublicUser) });
}

peopleRouter.get('/users/:id/followers', (req, res) => followList(req, res, true));
peopleRouter.get('/users/:id/following', (req, res) => followList(req, res, false));

// --- Blocking -----------------------------------------------------------------------------

peopleRouter.post('/users/:id/block', async (req, res) => {
  const me = currentUser(req);
  const otherId = String(req.params.id);
  if (otherId === me.id) throw new HttpError(400, 'bad_request', 'You can’t block yourself.');
  await db.insert(blocks).values({ blockerId: me.id, blockedId: otherId }).onConflictDoNothing();
  // Blocking also removes any follow in either direction.
  await db
    .delete(follows)
    .where(
      or(
        and(eq(follows.followerId, me.id), eq(follows.followeeId, otherId)),
        and(eq(follows.followerId, otherId), eq(follows.followeeId, me.id)),
      ),
    );
  res.status(204).end();
});

peopleRouter.delete('/users/:id/block', async (req, res) => {
  const me = currentUser(req);
  await db
    .delete(blocks)
    .where(and(eq(blocks.blockerId, me.id), eq(blocks.blockedId, String(req.params.id))));
  res.status(204).end();
});

peopleRouter.get('/me/blocks', async (req, res) => {
  const me = currentUser(req);
  const rows = await db
    .select({ id: users.id, username: users.username, displayName: users.displayName })
    .from(blocks)
    .innerJoin(users, eq(users.id, blocks.blockedId))
    .where(eq(blocks.blockerId, me.id));
  res.json({ users: rows.map(toPublicUser) });
});

export { blockedEitherWay };

import { and, asc, eq, or, sql } from 'drizzle-orm';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';

import type { FeedResponse, WorkoutComment } from '../../../shared/api';
import { currentUser, isAdmin, requireAuth } from '../auth/middleware';
import { db } from '../db/client';
import { comments, kudos, users, workouts } from '../db/schema';
import { forbidden, notFound, parse } from '../lib/http';
import { assertClean } from './filter';
import { notify } from './notify';
import { requireUsername, toPublicUser, viewerFollowsOwner, viewerSharesClub } from './relations';
import { loadSharedWorkout, loadSharedWorkouts } from './sharedWorkouts';

export const socialRouter = Router();
socialRouter.use(requireAuth);

const commentLimiter = rateLimit({ windowMs: 60 * 1000, limit: 20 });

/**
 * The feed: your own shared workouts plus those of people you follow and your
 * club-mates, newest first. "cursor" is the last item's "startedAt:id", for paging.
 */
socialRouter.get('/feed', async (req, res) => {
  const me = currentUser(req);
  const { cursor } = parse(z.object({ cursor: z.string().optional() }), req.query);
  const [startedAt, id] = cursor?.split(':') ?? [];
  const PAGE = 20;
  const items = await loadSharedWorkouts(
    me.id,
    and(
      sql`${workouts.visibility} <> 'only_me'`,
      or(eq(workouts.userId, me.id), viewerFollowsOwner(me.id), viewerSharesClub(me.id)),
    ),
    {
      limit: PAGE,
      before: startedAt && id ? { startedAt: Number(startedAt), id } : undefined,
    },
  );
  const last = items[items.length - 1];
  res.json({
    items,
    nextCursor: items.length === PAGE && last ? `${last.startedAt}:${last.id}` : null,
  } satisfies FeedResponse);
});

async function visibleWorkout(viewerId: string, workoutId: string) {
  const workout = await loadSharedWorkout(viewerId, workoutId);
  if (!workout) throw notFound('This workout isn’t available.');
  return workout;
}

socialRouter.get('/workouts/:id', async (req, res) => {
  res.json(await visibleWorkout(currentUser(req).id, String(req.params.id)));
});

socialRouter.post('/workouts/:id/kudos', async (req, res) => {
  const me = currentUser(req);
  requireUsername(me);
  const workout = await visibleWorkout(me.id, String(req.params.id));
  const inserted = await db
    .insert(kudos)
    .values({ workoutId: workout.id, userId: me.id })
    .onConflictDoNothing()
    .returning();
  if (inserted.length > 0) {
    await notify({ userId: workout.owner.id, type: 'kudos', actorId: me.id, workoutId: workout.id });
  }
  res.json(await visibleWorkout(me.id, workout.id));
});

socialRouter.delete('/workouts/:id/kudos', async (req, res) => {
  const me = currentUser(req);
  await db
    .delete(kudos)
    .where(and(eq(kudos.workoutId, String(req.params.id)), eq(kudos.userId, me.id)));
  res.json(await visibleWorkout(me.id, String(req.params.id)));
});

socialRouter.get('/workouts/:id/comments', async (req, res) => {
  const me = currentUser(req);
  const workout = await visibleWorkout(me.id, String(req.params.id));
  const rows = await db
    .select({
      id: comments.id,
      body: comments.body,
      createdAt: comments.createdAt,
      userId: comments.userId,
      username: users.username,
      displayName: users.displayName,
    })
    .from(comments)
    .innerJoin(users, eq(users.id, comments.userId))
    .where(
      and(
        eq(comments.workoutId, workout.id),
        eq(comments.hidden, false),
        sql`${users.suspendedAt} is null`,
        sql`not exists (select 1 from blocks b where (b.blocker_id = ${comments.userId} and b.blocked_id = ${me.id}) or (b.blocker_id = ${me.id} and b.blocked_id = ${comments.userId}))`,
      ),
    )
    .orderBy(asc(comments.createdAt))
    .limit(200);
  res.json({
    comments: rows.map(
      (row): WorkoutComment => ({
        id: row.id,
        user: toPublicUser({ id: row.userId, username: row.username, displayName: row.displayName }),
        body: row.body,
        createdAt: row.createdAt.getTime(),
        // You can delete your own comments, and any on your own workouts.
        canDelete: row.userId === me.id || workout.owner.id === me.id || isAdmin(me),
      }),
    ),
  });
});

socialRouter.post('/workouts/:id/comments', commentLimiter, async (req, res) => {
  const me = currentUser(req);
  requireUsername(me);
  const workout = await visibleWorkout(me.id, String(req.params.id));
  const { body } = parse(z.object({ body: z.string().trim().min(1).max(500) }), req.body);
  assertClean(body, 'comment');
  await db.insert(comments).values({ workoutId: workout.id, userId: me.id, body });
  await notify({ userId: workout.owner.id, type: 'comment', actorId: me.id, workoutId: workout.id });
  res.status(201).end();
});

socialRouter.delete('/comments/:id', async (req, res) => {
  const me = currentUser(req);
  const [comment] = await db
    .select({ id: comments.id, userId: comments.userId, ownerId: workouts.userId })
    .from(comments)
    .innerJoin(workouts, eq(workouts.id, comments.workoutId))
    .where(eq(comments.id, String(req.params.id)));
  if (!comment) throw notFound();
  if (comment.userId !== me.id && comment.ownerId !== me.id && !isAdmin(me)) throw forbidden();
  await db.delete(comments).where(eq(comments.id, comment.id));
  res.status(204).end();
});

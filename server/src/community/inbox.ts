import { and, desc, eq, isNull, lt } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';

import type { InboxItem } from '../../../shared/api';
import { currentUser, requireAuth } from '../auth/middleware';
import { db } from '../db/client';
import { notifications, pushTokens, users } from '../db/schema';
import { parse } from '../lib/http';
import { toPublicUser } from './relations';

export const inboxRouter = Router();
inboxRouter.use(requireAuth);

inboxRouter.get('/notifications', async (req, res) => {
  const me = currentUser(req);
  const { before } = parse(z.object({ before: z.coerce.number().optional() }), req.query);
  const rows = await db
    .select({ notification: notifications, actor: users })
    .from(notifications)
    .leftJoin(users, eq(users.id, notifications.actorId))
    .where(
      and(
        eq(notifications.userId, me.id),
        before ? lt(notifications.createdAt, new Date(before)) : undefined,
      ),
    )
    .orderBy(desc(notifications.createdAt))
    .limit(30);
  const items = rows.map(
    ({ notification, actor }): InboxItem => ({
      id: notification.id,
      type: notification.type,
      actor: actor ? toPublicUser(actor) : null,
      workoutId: notification.workoutId,
      clubId: notification.clubId,
      challengeId: notification.challengeId,
      count: notification.count,
      createdAt: notification.createdAt.getTime(),
      read: notification.readAt !== null,
    }),
  );
  const unread = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(eq(notifications.userId, me.id), isNull(notifications.readAt)))
    .limit(100);
  res.json({ items, unread: unread.length });
});

inboxRouter.post('/notifications/read', async (req, res) => {
  const me = currentUser(req);
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, me.id), isNull(notifications.readAt)));
  res.status(204).end();
});

/** The phone sends its Expo push token after the user allows notifications. */
inboxRouter.post('/push-tokens', async (req, res) => {
  const me = currentUser(req);
  const { token } = parse(z.object({ token: z.string().min(10).max(200) }), req.body);
  await db
    .insert(pushTokens)
    .values({ token, userId: me.id })
    .onConflictDoUpdate({ target: pushTokens.token, set: { userId: me.id } });
  res.status(204).end();
});

inboxRouter.delete('/push-tokens', async (req, res) => {
  const { token } = parse(z.object({ token: z.string() }), req.body);
  await db.delete(pushTokens).where(eq(pushTokens.token, token));
  res.status(204).end();
});

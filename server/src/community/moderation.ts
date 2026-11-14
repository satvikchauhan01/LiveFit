import { and, desc, eq } from 'drizzle-orm';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';

import { currentUser, requireAdmin, requireAuth } from '../auth/middleware';
import { db } from '../db/client';
import { clubs, comments, reports, users, workoutShares } from '../db/schema';
import { notFound, parse } from '../lib/http';

// Reporting (anyone) and moderation (people listed in ADMIN_EMAILS).

export const moderationRouter = Router();
moderationRouter.use(requireAuth);

const reportLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 30 });

moderationRouter.post('/reports', reportLimiter, async (req, res) => {
  const me = currentUser(req);
  const body = parse(
    z.object({
      targetType: z.enum(['user', 'workout', 'comment', 'club']),
      targetId: z.string().min(1).max(64),
      reason: z.enum(['spam', 'harassment', 'inappropriate', 'cheating', 'other']),
      details: z.string().trim().max(1000).default(''),
    }),
    req.body,
  );
  await db.insert(reports).values({ reporterId: me.id, ...body });
  res.status(201).end();
});

moderationRouter.get('/admin/reports', requireAdmin, async (_req, res) => {
  const rows = await db
    .select()
    .from(reports)
    .where(eq(reports.status, 'open'))
    .orderBy(desc(reports.createdAt))
    .limit(100);
  res.json({
    reports: rows.map((row) => ({ ...row, createdAt: row.createdAt.getTime(), resolvedAt: null })),
  });
});

/**
 * Resolves a report: "dismiss" (nothing wrong), "hide" (hide the workout,
 * comment or club), or "suspend" (suspend the person who posted it).
 */
moderationRouter.post('/admin/reports/:id', requireAdmin, async (req, res) => {
  const { action } = parse(z.object({ action: z.enum(['dismiss', 'hide', 'suspend']) }), req.body);
  const [report] = await db.select().from(reports).where(eq(reports.id, String(req.params.id)));
  if (!report) throw notFound();

  if (action === 'hide') {
    if (report.targetType === 'workout') {
      await db
        .insert(workoutShares)
        .values({ workoutId: report.targetId, hidden: true })
        .onConflictDoUpdate({ target: workoutShares.workoutId, set: { hidden: true } });
    } else if (report.targetType === 'comment') {
      await db.update(comments).set({ hidden: true }).where(eq(comments.id, report.targetId));
    } else if (report.targetType === 'club') {
      await db.update(clubs).set({ hidden: true }).where(eq(clubs.id, report.targetId));
    }
  }
  if (action === 'suspend') {
    let userId: string | null = report.targetType === 'user' ? report.targetId : null;
    if (report.targetType === 'comment') {
      const [comment] = await db.select().from(comments).where(eq(comments.id, report.targetId));
      userId = comment?.userId ?? null;
    }
    if (userId) {
      await db.update(users).set({ suspendedAt: new Date() }).where(eq(users.id, userId));
    }
  }

  await db
    .update(reports)
    .set({ status: action === 'dismiss' ? 'dismissed' : 'actioned', resolvedAt: new Date() })
    .where(and(eq(reports.id, report.id), eq(reports.status, 'open')));
  res.status(204).end();
});

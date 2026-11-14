import { randomBytes, timingSafeEqual } from 'node:crypto';

import { and, eq, gt, isNull } from 'drizzle-orm';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';

import type { LiveShareStart } from '../../../shared/api';
import { currentUser, requireAuth } from '../auth/middleware';
import { db } from '../db/client';
import { liveShares, users } from '../db/schema';
import { env } from '../env';
import { sha256 } from '../lib/crypto';
import { HttpError, notFound, parse, unauthorized } from '../lib/http';
import { escapeHtml } from '../lib/pages';
import { livePage } from './page';

// Live location sharing: while recording, the phone posts its position to a
// secret link that friends or family can open in any browser. Free for
// everyone; it's a safety feature. The link stops working when the workout
// ends, or after a few hours at most.

export const liveRouter = Router();
export const livePages = Router();

const MAX_TRAIL_POINTS = 600;
const ACTIVITIES = ['run', 'walk', 'cycle', 'hike', 'wheelchair'] as const;

const updateLimiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});

function sameHash(key: string, hash: string): boolean {
  const a = Buffer.from(sha256(key), 'hex');
  const b = Buffer.from(hash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

/** The share, if this request carries its write key (sent as a Bearer token). */
async function shareForWriter(id: string, authorization: string | undefined) {
  const key = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!z.uuid().safeParse(id).success || !key) throw unauthorized();
  const [share] = await db.select().from(liveShares).where(eq(liveShares.id, id));
  if (!share || !sameHash(key, share.writeKeyHash)) throw unauthorized();
  return share;
}

liveRouter.post('/live-shares', requireAuth, async (req, res) => {
  const me = currentUser(req);
  const body = parse(
    z.object({
      activity: z.enum(ACTIVITIES),
      hours: z.number().int().min(1).max(12).default(6),
    }),
    req.body,
  );
  // Only one live link at a time: starting a new one ends the old.
  await db
    .update(liveShares)
    .set({ endedAt: new Date() })
    .where(and(eq(liveShares.userId, me.id), isNull(liveShares.endedAt)));

  const token = randomBytes(18).toString('base64url');
  const writeKey = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + body.hours * 3_600_000);
  const [share] = await db
    .insert(liveShares)
    .values({
      userId: me.id,
      token,
      writeKeyHash: sha256(writeKey),
      activity: body.activity,
      expiresAt,
    })
    .returning();
  const result: LiveShareStart = {
    id: share.id,
    url: `${env.APP_URL}/live/${token}`,
    expiresAt: expiresAt.getTime(),
    writeKey,
  };
  res.status(201).json(result);
});

liveRouter.post('/live-shares/:id/position', updateLimiter, async (req, res) => {
  const share = await shareForWriter(String(req.params.id), req.headers.authorization);
  if (share.endedAt || share.expiresAt.getTime() < Date.now()) {
    throw new HttpError(410, 'share_ended', 'This live link has ended.');
  }
  const body = parse(
    z.object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
      at: z.number(),
      distanceM: z.number().min(0).nullable().default(null),
    }),
    req.body,
  );
  const trail = [...share.trail, [body.lat, body.lng] as [number, number]];
  await db
    .update(liveShares)
    .set({
      lastLat: body.lat,
      lastLng: body.lng,
      // Never trust the phone's clock to be in the future.
      lastAt: new Date(Math.min(body.at, Date.now())),
      distanceM: body.distanceM,
      // Keep every other point once the trail gets long, so it stays small but complete.
      trail:
        trail.length > MAX_TRAIL_POINTS
          ? trail.filter((_, index) => index % 2 === 0 || index === trail.length - 1)
          : trail,
    })
    .where(eq(liveShares.id, share.id));
  res.status(204).end();
});

liveRouter.post('/live-shares/:id/end', async (req, res) => {
  const share = await shareForWriter(String(req.params.id), req.headers.authorization);
  if (!share.endedAt) {
    await db.update(liveShares).set({ endedAt: new Date() }).where(eq(liveShares.id, share.id));
  }
  res.status(204).end();
});

// --- The page friends open -------------------------------------------------------------

async function viewable(token: string) {
  const [row] = await db
    .select({ share: liveShares, name: users.displayName })
    .from(liveShares)
    .innerJoin(users, eq(users.id, liveShares.userId))
    // A day after it expires, the link stops showing anything at all.
    .where(
      and(
        eq(liveShares.token, token),
        gt(liveShares.expiresAt, new Date(Date.now() - 24 * 3_600_000)),
      ),
    );
  return row ?? null;
}

livePages.get('/live/:token', async (req, res) => {
  const row = await viewable(String(req.params.token));
  if (!row) throw notFound('This live link has ended.');
  // The page loads its map from a CDN and OpenStreetMap, so it gets its own
  // content policy instead of the strict default.
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'none'",
      "script-src 'self' 'unsafe-inline' https://unpkg.com",
      "style-src 'unsafe-inline' https://unpkg.com",
      "img-src 'self' data: https://*.tile.openstreetmap.org https://unpkg.com",
      "connect-src 'self'",
      "base-uri 'none'",
      "frame-ancestors 'none'",
    ].join('; '),
  );
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Robots-Tag', 'noindex');
  res.send(livePage(escapeHtml(row.name || 'A LiveFit athlete'), String(req.params.token)));
});

livePages.get('/live/:token/data', async (req, res) => {
  const row = await viewable(String(req.params.token));
  if (!row) throw notFound('This live link has ended.');
  const { share } = row;
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    activity: share.activity,
    startedAt: share.startedAt.getTime(),
    lastAt: share.lastAt?.getTime() ?? null,
    position: share.lastLat !== null && share.lastLng !== null ? [share.lastLat, share.lastLng] : null,
    trail: share.trail,
    distanceM: share.distanceM,
    ended: share.endedAt !== null || share.expiresAt.getTime() < Date.now(),
  });
});

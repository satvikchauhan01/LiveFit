import { timingSafeEqual } from 'node:crypto';

import { and, desc, eq, gt } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';

import type { ProStatus } from '../../../shared/api';
import { currentUser, requireAuth } from '../auth/middleware';
import { db } from '../db/client';
import { purchases, users } from '../db/schema';
import { env } from '../env';
import { sha256 } from '../lib/crypto';
import { HttpError, parse } from '../lib/http';
import { acknowledge, entitlementEnd, getSubscription } from './googlePlay';
import { isPro } from './pro';

// LiveFit Pro on Android: the app buys the subscription through Google Play,
// then sends the purchase token here. The server asks Google whether it's real,
// links it to the account, acknowledges it, and records until when Pro runs.
// Google's real-time notifications keep renewals and cancellations up to date.

export const billingRouter = Router();
export const billingWebhooks = Router();

/** Product ids the server accepts (set up in Play Console → Monetize → Subscriptions). */
export const PRO_PRODUCT_IDS = new Set(['livefit_pro']);

/** The id the app passes to Google Play, so a purchase can't be claimed by someone else. */
export function obfuscatedAccountId(userId: string): string {
  return sha256(`livefit:${userId}`).slice(0, 64);
}

function toStatus(proUntil: Date | null): ProStatus {
  return { isPro: isPro(proUntil), proUntil: proUntil?.getTime() ?? null };
}

/** Works out Pro from every purchase the person has, so one ending doesn't hide another. */
async function refreshProUntil(userId: string): Promise<Date | null> {
  const [latest] = await db
    .select({ expiresAt: purchases.expiresAt })
    .from(purchases)
    .where(and(eq(purchases.userId, userId), gt(purchases.expiresAt, new Date())))
    .orderBy(desc(purchases.expiresAt))
    .limit(1);
  const proUntil = latest?.expiresAt ?? null;
  await db.update(users).set({ proUntil }).where(eq(users.id, userId));
  return proUntil;
}

async function checkPurchase(userId: string, purchaseToken: string, productId: string) {
  const subscription = await getSubscription(purchaseToken);
  const owner = subscription.externalAccountIdentifiers?.obfuscatedExternalAccountId;
  if (owner && owner !== obfuscatedAccountId(userId)) {
    throw new HttpError(409, 'purchase_other_account', 'This purchase belongs to another LiveFit account.');
  }
  const end = entitlementEnd(subscription);
  await db
    .insert(purchases)
    .values({
      purchaseToken,
      userId,
      productId,
      expiresAt: end,
      state: subscription.subscriptionState,
    })
    .onConflictDoUpdate({
      target: purchases.purchaseToken,
      set: { expiresAt: end, state: subscription.subscriptionState, updatedAt: new Date() },
      // A token already linked to a different account stays with that account.
      setWhere: eq(purchases.userId, userId),
    });
  const [stored] = await db
    .select({ userId: purchases.userId })
    .from(purchases)
    .where(eq(purchases.purchaseToken, purchaseToken));
  if (stored && stored.userId !== userId) {
    throw new HttpError(409, 'purchase_other_account', 'This purchase belongs to another LiveFit account.');
  }
  if (end && subscription.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_PENDING') {
    await acknowledge(productId, purchaseToken);
  }
  return refreshProUntil(userId);
}

billingRouter.get('/billing/status', requireAuth, (req, res) => {
  res.json(toStatus(currentUser(req).proUntil));
});

billingRouter.get('/billing/account-id', requireAuth, (req, res) => {
  res.json({ obfuscatedAccountId: obfuscatedAccountId(currentUser(req).id) });
});

billingRouter.post('/billing/google/verify', requireAuth, async (req, res) => {
  const me = currentUser(req);
  const body = parse(
    z.object({ purchaseToken: z.string().min(10).max(500), productId: z.string().max(100) }),
    req.body,
  );
  if (!PRO_PRODUCT_IDS.has(body.productId)) {
    throw new HttpError(400, 'unknown_product', 'That isn’t a LiveFit product.');
  }
  res.json(toStatus(await checkPurchase(me.id, body.purchaseToken, body.productId)));
});

// --- Real-time developer notifications --------------------------------------------------
// Play Console → Monetization setup → a Pub/Sub topic with a push subscription to
// https://<server>/billing/google/notifications?secret=<GOOGLE_PLAY_RTDN_SECRET>

function secretMatches(given: unknown): boolean {
  if (!env.GOOGLE_PLAY_RTDN_SECRET || typeof given !== 'string') return false;
  const a = Buffer.from(sha256(given), 'hex');
  const b = Buffer.from(sha256(env.GOOGLE_PLAY_RTDN_SECRET), 'hex');
  return timingSafeEqual(a, b);
}

billingWebhooks.post('/billing/google/notifications', async (req, res) => {
  if (!secretMatches(req.query.secret)) {
    res.status(401).end();
    return;
  }
  const envelope = req.body as { message?: { data?: string } };
  let notification: {
    subscriptionNotification?: { purchaseToken?: string; subscriptionId?: string };
  } = {};
  try {
    notification = JSON.parse(Buffer.from(envelope.message?.data ?? '', 'base64').toString('utf8'));
  } catch {
    // Not a message we understand: acknowledge it so Pub/Sub doesn't retry forever.
  }
  const token = notification.subscriptionNotification?.purchaseToken;
  if (token) {
    const [purchase] = await db.select().from(purchases).where(eq(purchases.purchaseToken, token));
    // Unknown tokens are purchases the app hasn't reported yet; the app's own
    // check will pick them up.
    if (purchase) {
      try {
        await checkPurchase(purchase.userId, token, purchase.productId);
      } catch (error) {
        console.error('[billing] notification check failed', error);
        res.status(500).end(); // Pub/Sub will retry
        return;
      }
    }
  }
  res.status(204).end();
});

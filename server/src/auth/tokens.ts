import { randomUUID } from 'node:crypto';

import { and, eq, gt, isNull } from 'drizzle-orm';
import { jwtVerify, SignJWT } from 'jose';

import { db } from '../db/client';
import { refreshTokens } from '../db/schema';
import { env } from '../env';
import { randomToken, sha256 } from '../lib/crypto';
import { unauthorized } from '../lib/http';

// Two kinds of token:
// - Access token: a signed JWT the app sends with every request. Short-lived
//   (15 minutes), and checked without touching the database.
// - Refresh token: a long random string kept in the phone's secure storage and
//   only stored as a hash here. It's swapped for a new pair when the access
//   token runs out, and can be revoked (sign out, password change, theft).

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_MS = 60 * 24 * 60 * 60 * 1000; // 60 days
const AUDIENCE = 'livefit-app';

const secret = new TextEncoder().encode(env.JWT_SECRET);

export async function createAccessToken(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_TTL)
    .sign(secret);
}

/** The user id inside a valid access token; throws 401 otherwise. */
export async function readAccessToken(token: string): Promise<string> {
  try {
    const { payload } = await jwtVerify(token, secret, {
      audience: AUDIENCE,
      algorithms: ['HS256'],
    });
    if (!payload.sub) throw new Error('missing subject');
    return payload.sub;
  } catch {
    throw unauthorized('Your session has expired.', 'token_expired');
  }
}

async function storeRefreshToken(userId: string, familyId: string): Promise<string> {
  const token = randomToken();
  await db.insert(refreshTokens).values({
    userId,
    familyId,
    tokenHash: sha256(token),
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
  });
  return token;
}

/** A fresh access + refresh token pair for a new sign-in. */
export async function startSession(userId: string) {
  const [accessToken, refreshToken] = await Promise.all([
    createAccessToken(userId),
    storeRefreshToken(userId, randomUUID()),
  ]);
  return { accessToken, refreshToken };
}

/**
 * Swaps a refresh token for a new pair ("rotation"). Using a token that was
 * already swapped means it was copied, so every token in its family is revoked.
 */
export async function rotateRefreshToken(token: string) {
  const [stored] = await db
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, sha256(token)));

  if (!stored || stored.expiresAt.getTime() < Date.now()) {
    throw unauthorized('Please sign in again.', 'session_ended');
  }
  if (stored.revokedAt) {
    await revokeFamily(stored.familyId);
    throw unauthorized('Please sign in again.', 'session_ended');
  }

  // Revoke the old token only if nobody else revoked it in the meantime (two
  // refreshes racing): exactly one of them wins.
  const revoked = await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.id, stored.id), isNull(refreshTokens.revokedAt)))
    .returning({ id: refreshTokens.id });
  if (revoked.length === 0) {
    throw unauthorized('Please sign in again.', 'session_ended');
  }

  const [accessToken, refreshToken] = await Promise.all([
    createAccessToken(stored.userId),
    storeRefreshToken(stored.userId, stored.familyId),
  ]);
  return { userId: stored.userId, accessToken, refreshToken };
}

async function revokeFamily(familyId: string) {
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.familyId, familyId), isNull(refreshTokens.revokedAt)));
}

/** Signs one device out. */
export async function revokeRefreshToken(token: string) {
  const [stored] = await db
    .select({ familyId: refreshTokens.familyId })
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, sha256(token)));
  if (stored) await revokeFamily(stored.familyId);
}

/** Signs every device out, e.g. after a password reset. */
export async function revokeAllSessions(userId: string) {
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(refreshTokens.userId, userId),
        isNull(refreshTokens.revokedAt),
        gt(refreshTokens.expiresAt, new Date()),
      ),
    );
}

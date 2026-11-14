import { and, eq, gt, isNull } from 'drizzle-orm';

import type { ApiUser } from '../../../shared/api';
import { db } from '../db/client';
import { emailTokens, type User, users } from '../db/schema';
import { adminEmails, env } from '../env';
import { randomToken, sha256 } from '../lib/crypto';
import { sendEmail } from '../lib/mailer';

export function toApiUser(user: User): ApiUser {
  return {
    id: user.id,
    email: user.email,
    emailVerified: user.emailVerifiedAt !== null,
    displayName: user.displayName,
    username: user.username,
    isPrivate: user.isPrivate,
    proUntil: user.proUntil?.getTime() ?? null,
    isAdmin: adminEmails.has(user.email),
    createdAt: user.createdAt.getTime(),
  };
}

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function findUserById(id: string): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.id, id));
  return user;
}

export async function findUserByEmail(email: string): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.email, normaliseEmail(email)));
  return user;
}

type EmailTokenKind = 'verify_email' | 'reset_password';

const TOKEN_LIFETIME_MS: Record<EmailTokenKind, number> = {
  verify_email: 48 * 60 * 60 * 1000,
  reset_password: 60 * 60 * 1000,
};

async function createEmailToken(userId: string, kind: EmailTokenKind): Promise<string> {
  const token = randomToken();
  await db.insert(emailTokens).values({
    userId,
    kind,
    tokenHash: sha256(token),
    expiresAt: new Date(Date.now() + TOKEN_LIFETIME_MS[kind]),
  });
  return token;
}

/** Marks a one-time link as used and returns its user id, or null if it's invalid or expired. */
export async function consumeEmailToken(token: string, kind: EmailTokenKind): Promise<string | null> {
  const [used] = await db
    .update(emailTokens)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(emailTokens.tokenHash, sha256(token)),
        eq(emailTokens.kind, kind),
        isNull(emailTokens.usedAt),
        gt(emailTokens.expiresAt, new Date()),
      ),
    )
    .returning({ userId: emailTokens.userId });
  return used?.userId ?? null;
}

export async function sendVerificationEmail(user: User): Promise<void> {
  const token = await createEmailToken(user.id, 'verify_email');
  const link = `${env.APP_URL}/verify-email?token=${encodeURIComponent(token)}`;
  await sendEmail({
    to: user.email,
    subject: 'Confirm your email for LiveFit',
    text: `Hi${user.displayName ? ` ${user.displayName}` : ''},\n\nConfirm your email address by opening this link:\n${link}\n\nIt works for 48 hours. If you didn't create a LiveFit account, you can ignore this email.`,
  });
}

export async function sendPasswordResetEmail(user: User): Promise<void> {
  const token = await createEmailToken(user.id, 'reset_password');
  const link = `${env.APP_URL}/reset-password?token=${encodeURIComponent(token)}`;
  await sendEmail({
    to: user.email,
    subject: 'Reset your LiveFit password',
    text: `Someone (hopefully you) asked to reset the password for this LiveFit account.\n\nChoose a new password here:\n${link}\n\nThe link works for one hour. If it wasn't you, ignore this email; your password stays the same.`,
  });
}

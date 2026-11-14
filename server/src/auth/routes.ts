import { eq } from 'drizzle-orm';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';

import type { AuthResponse } from '../../../shared/api';
import { db } from '../db/client';
import { users } from '../db/schema';
import { badRequest, HttpError, parse, unauthorized } from '../lib/http';
import { escapeHtml, page } from '../lib/pages';
import { currentUser, requireAuth } from './middleware';
import { checkPassword, hashPassword, MIN_PASSWORD_LENGTH } from './passwords';
import { revokeAllSessions, revokeRefreshToken, rotateRefreshToken, startSession } from './tokens';
import {
  consumeEmailToken,
  findUserByEmail,
  findUserById,
  normaliseEmail,
  sendPasswordResetEmail,
  sendVerificationEmail,
  toApiUser,
} from './users';

export const authRouter = Router();
/** Web pages opened from email links. */
export const authPages = Router();

// Slows down password guessing: 20 tries per 15 minutes per IP address.
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true });

const password = z.string().min(MIN_PASSWORD_LENGTH, `At least ${MIN_PASSWORD_LENGTH} characters.`).max(200);
const email = z.email('That doesn’t look like an email address.').max(254);

authRouter.post('/signup', authLimiter, async (req, res) => {
  const body = parse(
    z.object({ email, password, displayName: z.string().trim().max(40).default('') }),
    req.body,
  );
  if (await findUserByEmail(body.email)) {
    throw new HttpError(409, 'email_taken', 'There’s already an account with this email. Try signing in.');
  }
  const [user] = await db
    .insert(users)
    .values({
      email: normaliseEmail(body.email),
      passwordHash: await hashPassword(body.password),
      displayName: body.displayName,
    })
    .returning();

  await sendVerificationEmail(user);
  const session = await startSession(user.id);
  res.status(201).json({ user: toApiUser(user), ...session } satisfies AuthResponse);
});

authRouter.post('/login', authLimiter, async (req, res) => {
  const body = parse(z.object({ email, password: z.string() }), req.body);
  const user = await findUserByEmail(body.email);
  // The same message either way, so the response doesn't reveal which emails have accounts.
  if (!user || !(await checkPassword(user.passwordHash, body.password))) {
    throw unauthorized('Wrong email or password.', 'wrong_credentials');
  }
  if (user.suspendedAt) throw new HttpError(403, 'suspended', 'This account is suspended.');
  const session = await startSession(user.id);
  res.json({ user: toApiUser(user), ...session } satisfies AuthResponse);
});

authRouter.post('/refresh', async (req, res) => {
  const body = parse(z.object({ refreshToken: z.string().min(1) }), req.body);
  const session = await rotateRefreshToken(body.refreshToken);
  const user = await findUserById(session.userId);
  if (!user) throw unauthorized('This account no longer exists.', 'account_deleted');
  res.json({
    user: toApiUser(user),
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
  } satisfies AuthResponse);
});

authRouter.post('/logout', async (req, res) => {
  const body = parse(z.object({ refreshToken: z.string().min(1) }), req.body);
  await revokeRefreshToken(body.refreshToken);
  res.status(204).end();
});

authRouter.post('/resend-verification', requireAuth, async (req, res) => {
  const user = currentUser(req);
  if (!user.emailVerifiedAt) await sendVerificationEmail(user);
  res.status(204).end();
});

authRouter.post('/forgot-password', authLimiter, async (req, res) => {
  const body = parse(z.object({ email }), req.body);
  const user = await findUserByEmail(body.email);
  if (user) await sendPasswordResetEmail(user);
  // Always "sent", so this can't be used to find out who has an account.
  res.status(204).end();
});

authRouter.post('/change-password', requireAuth, async (req, res) => {
  const user = currentUser(req);
  const body = parse(z.object({ currentPassword: z.string(), newPassword: password }), req.body);
  if (!(await checkPassword(user.passwordHash, body.currentPassword))) {
    throw badRequest('Your current password isn’t right.', 'wrong_password');
  }
  await db
    .update(users)
    .set({ passwordHash: await hashPassword(body.newPassword) })
    .where(eq(users.id, user.id));
  // Sign out every other device, then give this one a fresh session.
  await revokeAllSessions(user.id);
  res.json({ user: toApiUser(user), ...(await startSession(user.id)) } satisfies AuthResponse);
});

// --- Pages opened from emails -----------------------------------------------------

authPages.get('/verify-email', async (req, res) => {
  const token = typeof req.query.token === 'string' ? req.query.token : '';
  const userId = token ? await consumeEmailToken(token, 'verify_email') : null;
  if (userId) {
    await db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, userId));
  }
  res.send(
    page(
      'Confirm email',
      userId
        ? '<h1>Email confirmed</h1><p class="ok">Thanks! You can go back to the LiveFit app.</p>'
        : '<h1>Link not valid</h1><p class="error">This link has expired or was already used. Open LiveFit and ask for a new one in Account.</p>',
    ),
  );
});

function resetForm(token: string, message = '') {
  return page(
    'Reset password',
    `<h1>Choose a new password</h1>
     ${message}
     <form method="post" action="/reset-password">
       <input type="hidden" name="token" value="${escapeHtml(token)}">
       <label for="password">New password</label>
       <input id="password" name="password" type="password" minlength="${MIN_PASSWORD_LENGTH}" required autocomplete="new-password">
       <button type="submit">Save new password</button>
     </form>`,
  );
}

authPages.get('/reset-password', (req, res) => {
  const token = typeof req.query.token === 'string' ? req.query.token : '';
  res.send(resetForm(token));
});

authPages.post('/reset-password', async (req, res) => {
  const token = typeof req.body?.token === 'string' ? req.body.token : '';
  const newPassword = typeof req.body?.password === 'string' ? req.body.password : '';
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    res.send(resetForm(token, `<p class="error">Use at least ${MIN_PASSWORD_LENGTH} characters.</p>`));
    return;
  }
  const userId = await consumeEmailToken(token, 'reset_password');
  if (!userId) {
    res.send(
      page(
        'Reset password',
        '<h1>Link not valid</h1><p class="error">This link has expired or was already used. Ask for a new one from the LiveFit sign-in screen.</p>',
      ),
    );
    return;
  }
  await db
    .update(users)
    .set({ passwordHash: await hashPassword(newPassword), emailVerifiedAt: new Date() })
    .where(eq(users.id, userId));
  await revokeAllSessions(userId);
  res.send(
    page(
      'Password changed',
      '<h1>Password changed</h1><p class="ok">Sign in to LiveFit with your new password. Other devices have been signed out.</p>',
    ),
  );
});

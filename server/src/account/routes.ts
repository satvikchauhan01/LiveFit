import { and, eq, isNull } from 'drizzle-orm';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';

import { db } from '../db/client';
import { userDocs, users, workouts } from '../db/schema';
import { currentUser, requireAuth } from '../auth/middleware';
import { checkPassword } from '../auth/passwords';
import { findUserByEmail, toApiUser } from '../auth/users';
import { badRequest, parse } from '../lib/http';
import { page } from '../lib/pages';

export const accountRouter = Router();
/** The web page Google Play requires: delete an account without the app. */
export const accountPages = Router();

accountRouter.use(requireAuth);

accountRouter.get('/', (req, res) => {
  res.json({ user: toApiUser(currentUser(req)) });
});

accountRouter.patch('/', async (req, res) => {
  const body = parse(
    z.object({
      displayName: z.string().trim().max(40).optional(),
      isPrivate: z.boolean().optional(),
    }),
    req.body,
  );
  const [user] = await db.update(users).set(body).where(eq(users.id, currentUser(req).id)).returning();
  res.json({ user: toApiUser(user) });
});

/** Everything the server holds about you, as one JSON file (GDPR-style data export). */
accountRouter.get('/export', async (req, res) => {
  const user = currentUser(req);
  const [allWorkouts, docs] = await Promise.all([
    db
      .select()
      .from(workouts)
      .where(and(eq(workouts.userId, user.id), isNull(workouts.deletedAt))),
    db
      .select()
      .from(userDocs)
      .where(and(eq(userDocs.userId, user.id), eq(userDocs.deleted, false))),
  ]);
  res.setHeader('Content-Disposition', 'attachment; filename="livefit-export.json"');
  res.json({
    exportedAt: new Date().toISOString(),
    user: toApiUser(user),
    workouts: allWorkouts.map(({ changeSeq: _seq, ...workout }) => workout),
    documents: docs.map(({ changeSeq: _seq, ...doc }) => doc),
  });
});

/** Deletes the account and everything in it (the database cascades to every table). */
accountRouter.delete('/', async (req, res) => {
  const user = currentUser(req);
  const body = parse(z.object({ password: z.string() }), req.body);
  if (!(await checkPassword(user.passwordHash, body.password))) {
    throw badRequest('That password isn’t right.', 'wrong_password');
  }
  await db.delete(users).where(eq(users.id, user.id));
  res.status(204).end();
});

// --- Web deletion page -------------------------------------------------------------

const deleteLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10 });

function deleteForm(message = '') {
  return page(
    'Delete account',
    `<h1>Delete your LiveFit account</h1>
     <p>This permanently deletes your account and every workout, route and setting stored on the LiveFit server. It can’t be undone. Workouts saved only on your phone stay there until you uninstall the app.</p>
     ${message}
     <form method="post" action="/account/delete">
       <label for="email">Email</label>
       <input id="email" name="email" type="email" required autocomplete="email">
       <label for="password">Password</label>
       <input id="password" name="password" type="password" required autocomplete="current-password">
       <button class="danger" type="submit">Delete my account</button>
     </form>`,
  );
}

accountPages.get('/account/delete', (_req, res) => {
  res.send(deleteForm());
});

accountPages.post('/account/delete', deleteLimiter, async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const user = email ? await findUserByEmail(email) : undefined;
  if (!user || !(await checkPassword(user.passwordHash, password))) {
    res.send(deleteForm('<p class="error">Wrong email or password.</p>'));
    return;
  }
  await db.delete(users).where(eq(users.id, user.id));
  res.send(
    page(
      'Account deleted',
      '<h1>Account deleted</h1><p class="ok">Your account and all its data have been deleted from the LiveFit server.</p>',
    ),
  );
});

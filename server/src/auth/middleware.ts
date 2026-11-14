import type { NextFunction, Request, Response } from 'express';

import type { User } from '../db/schema';
import { adminEmails } from '../env';
import { forbidden, unauthorized } from '../lib/http';
import { readAccessToken } from './tokens';
import { findUserById } from './users';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Set by requireAuth. */
      user?: User;
    }
  }
}

/** Rejects requests without a valid access token, and loads the signed-in user. */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
  if (!token) throw unauthorized();

  const user = await findUserById(await readAccessToken(token));
  if (!user) throw unauthorized('This account no longer exists.', 'account_deleted');
  if (user.suspendedAt) throw forbidden('This account is suspended.', 'suspended');

  req.user = user;
  next();
}

/** The signed-in user; only use after requireAuth. */
export function currentUser(req: Request): User {
  if (!req.user) throw unauthorized();
  return req.user;
}

export function isAdmin(user: User): boolean {
  return adminEmails.has(user.email);
}

export async function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!isAdmin(currentUser(req))) throw forbidden();
  next();
}

import { randomBytes } from 'node:crypto';

import { and, eq, inArray, sql } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';

import type { ClubMember, ClubSummary } from '../../../shared/api';
import { currentUser, requireAuth } from '../auth/middleware';
import { db } from '../db/client';
import { clubMembers, clubs, users, workouts } from '../db/schema';
import { forbidden, HttpError, notFound, parse } from '../lib/http';
import { assertClean } from './filter';
import { notify } from './notify';
import { requireUsername, toPublicUser } from './relations';
import { loadSharedWorkouts } from './sharedWorkouts';

export const clubsRouter = Router();
clubsRouter.use(requireAuth);

/** Short, easy-to-type invite codes without look-alike characters (0/O, 1/I). */
export function inviteCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(randomBytes(8), (byte) => alphabet[byte % alphabet.length]).join('');
}

async function membership(clubId: string, userId: string) {
  const [row] = await db
    .select()
    .from(clubMembers)
    .where(and(eq(clubMembers.clubId, clubId), eq(clubMembers.userId, userId)));
  return row ?? null;
}

async function summary(clubId: string, viewerId: string): Promise<ClubSummary> {
  const [club] = await db.select().from(clubs).where(eq(clubs.id, clubId));
  if (!club || club.hidden) throw notFound('This club isn’t available.');
  const member = await membership(clubId, viewerId);
  const [count] = await db
    .select({ members: sql<number>`count(*)::int` })
    .from(clubMembers)
    .where(eq(clubMembers.clubId, clubId));
  return {
    id: club.id,
    name: club.name,
    description: club.description,
    members: count?.members ?? 0,
    role: member?.role ?? null,
    // Only members see the invite code.
    inviteCode: member ? club.inviteCode : null,
  };
}

async function requireMember(clubId: string, userId: string, roles?: ('owner' | 'admin')[]) {
  const member = await membership(clubId, userId);
  if (!member) throw notFound('This club isn’t available.');
  if (roles && !roles.includes(member.role as 'owner' | 'admin')) throw forbidden();
  return member;
}

clubsRouter.get('/clubs', async (req, res) => {
  const me = currentUser(req);
  const mine = await db
    .select({ clubId: clubMembers.clubId })
    .from(clubMembers)
    .innerJoin(clubs, eq(clubs.id, clubMembers.clubId))
    .where(and(eq(clubMembers.userId, me.id), eq(clubs.hidden, false)));
  res.json({ clubs: await Promise.all(mine.map((row) => summary(row.clubId, me.id))) });
});

clubsRouter.post('/clubs', async (req, res) => {
  const me = currentUser(req);
  requireUsername(me);
  const body = parse(
    z.object({
      name: z.string().trim().min(2).max(60),
      description: z.string().trim().max(300).default(''),
    }),
    req.body,
  );
  assertClean(body.name, 'club name');
  assertClean(body.description, 'description');
  const [club] = await db
    .insert(clubs)
    .values({ ...body, inviteCode: inviteCode() })
    .returning();
  await db.insert(clubMembers).values({ clubId: club.id, userId: me.id, role: 'owner' });
  res.status(201).json(await summary(club.id, me.id));
});

clubsRouter.post('/clubs/join', async (req, res) => {
  const me = currentUser(req);
  requireUsername(me);
  const { code } = parse(z.object({ code: z.string().trim().min(4).max(16) }), req.body);
  const [club] = await db.select().from(clubs).where(eq(clubs.inviteCode, code.toUpperCase()));
  if (!club || club.hidden) throw notFound('No club has that invite code.');
  const inserted = await db
    .insert(clubMembers)
    .values({ clubId: club.id, userId: me.id, role: 'member' })
    .onConflictDoNothing()
    .returning();
  if (inserted.length > 0) {
    const leaders = await db
      .select({ userId: clubMembers.userId })
      .from(clubMembers)
      .where(and(eq(clubMembers.clubId, club.id), inArray(clubMembers.role, ['owner', 'admin'])));
    for (const leader of leaders) {
      await notify({ userId: leader.userId, type: 'club_join', actorId: me.id, clubId: club.id });
    }
  }
  res.json(await summary(club.id, me.id));
});

clubsRouter.get('/clubs/:id', async (req, res) => {
  const me = currentUser(req);
  const clubId = String(req.params.id);
  await requireMember(clubId, me.id);
  const members = await db
    .select({ id: users.id, username: users.username, displayName: users.displayName, role: clubMembers.role })
    .from(clubMembers)
    .innerJoin(users, eq(users.id, clubMembers.userId))
    .where(and(eq(clubMembers.clubId, clubId), sql`${users.suspendedAt} is null`));
  res.json({
    club: await summary(clubId, me.id),
    members: members.map((member): ClubMember => ({ ...toPublicUser(member), role: member.role })),
  });
});

/** Workouts from club members that the viewer may see. */
clubsRouter.get('/clubs/:id/feed', async (req, res) => {
  const me = currentUser(req);
  const clubId = String(req.params.id);
  await requireMember(clubId, me.id);
  const items = await loadSharedWorkouts(
    me.id,
    and(
      sql`${workouts.visibility} <> 'only_me'`,
      sql`exists (select 1 from club_members m where m.club_id = ${clubId} and m.user_id = ${workouts.userId})`,
    ),
    { limit: 30 },
  );
  res.json({ items, nextCursor: null });
});

clubsRouter.post('/clubs/:id/invite', async (req, res) => {
  const me = currentUser(req);
  const clubId = String(req.params.id);
  await requireMember(clubId, me.id, ['owner', 'admin']);
  await db.update(clubs).set({ inviteCode: inviteCode() }).where(eq(clubs.id, clubId));
  res.json(await summary(clubId, me.id));
});

clubsRouter.patch('/clubs/:id/members/:userId', async (req, res) => {
  const me = currentUser(req);
  const clubId = String(req.params.id);
  await requireMember(clubId, me.id, ['owner']);
  const { role } = parse(z.object({ role: z.enum(['admin', 'member']) }), req.body);
  await db
    .update(clubMembers)
    .set({ role })
    .where(and(eq(clubMembers.clubId, clubId), eq(clubMembers.userId, String(req.params.userId))));
  res.status(204).end();
});

clubsRouter.delete('/clubs/:id/members/:userId', async (req, res) => {
  const me = currentUser(req);
  const clubId = String(req.params.id);
  const targetId = req.params.userId === 'me' ? me.id : String(req.params.userId);
  const mine = await requireMember(clubId, me.id);
  if (targetId !== me.id && mine.role === 'member') throw forbidden();
  const target = await membership(clubId, targetId);
  if (!target) throw notFound();
  if (target.role === 'owner') {
    throw new HttpError(400, 'owner_cannot_leave', 'The owner can’t leave. Delete the club instead.');
  }
  await db
    .delete(clubMembers)
    .where(and(eq(clubMembers.clubId, clubId), eq(clubMembers.userId, targetId)));
  res.status(204).end();
});

clubsRouter.delete('/clubs/:id', async (req, res) => {
  const me = currentUser(req);
  const clubId = String(req.params.id);
  await requireMember(clubId, me.id, ['owner']);
  await db.delete(clubs).where(eq(clubs.id, clubId));
  res.status(204).end();
});

export { membership as clubMembership };

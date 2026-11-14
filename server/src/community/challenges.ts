import { and, desc, eq, gte, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';

import type { ChallengeSummary, LeaderboardRow } from '../../../shared/api';
import { isPro } from '../billing/pro';
import { currentUser, requireAdmin, requireAuth } from '../auth/middleware';
import { db } from '../db/client';
import {
  type Challenge,
  challengeParticipants,
  challenges,
  clubMembers,
  users,
  type Workout,
  workoutShares,
  workouts,
} from '../db/schema';
import { forbidden, HttpError, notFound, parse } from '../lib/http';
import { onWorkoutSavedListener } from '../sync/hooks';
import { inviteCode, clubMembership } from './clubs';
import { assertClean } from './filter';
import { notify } from './notify';
import { requireUsername, toPublicUser } from './relations';

export const challengesRouter = Router();
challengesRouter.use(requireAuth);


async function participantCount(challengeId: string) {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(challengeParticipants)
    .where(eq(challengeParticipants.challengeId, challengeId));
  return row?.count ?? 0;
}

async function toSummary(challenge: Challenge, viewerId: string): Promise<ChallengeSummary> {
  const [joined] = await db
    .select()
    .from(challengeParticipants)
    .where(
      and(eq(challengeParticipants.challengeId, challenge.id), eq(challengeParticipants.userId, viewerId)),
    );
  return {
    id: challenge.id,
    title: challenge.title,
    kind: challenge.kind,
    activityTypes: challenge.activityTypes,
    targetDistanceM: challenge.targetDistanceM,
    targetDurationS: challenge.targetDurationS,
    targetCount: challenge.targetCount,
    targetVolumeKg: challenge.targetVolumeKg,
    targetStrengthSessions: challenge.targetStrengthSessions,
    startsAt: challenge.startsAt.getTime(),
    endsAt: challenge.endsAt.getTime(),
    timezone: challenge.timezone,
    clubId: challenge.clubId,
    isPublic: challenge.isPublic,
    featured: challenge.featured,
    participants: await participantCount(challenge.id),
    joined: Boolean(joined),
    inviteCode: joined ? challenge.inviteCode : null,
    allowManual: challenge.allowManual,
  };
}

/** Participants, club members, and (for public challenges) everyone may see a challenge. */
async function visibleChallenge(challengeId: string, viewerId: string): Promise<Challenge> {
  const [challenge] = await db.select().from(challenges).where(eq(challenges.id, challengeId));
  if (!challenge) throw notFound('This challenge isn’t available.');
  if (challenge.isPublic) return challenge;
  const [joined] = await db
    .select()
    .from(challengeParticipants)
    .where(and(eq(challengeParticipants.challengeId, challengeId), eq(challengeParticipants.userId, viewerId)));
  if (joined) return challenge;
  if (challenge.clubId && (await clubMembership(challenge.clubId, viewerId))) return challenge;
  throw notFound('This challenge isn’t available.');
}

// --- Leaderboard ---------------------------------------------------------------------------
//
// Worked out on the server from synced workouts, never from numbers a phone
// sends. Distance only counts from GPS workouts that passed the fair-play
// checks; typed-in and imported workouts never count for distance, and count
// for the other kinds only if the creator allowed it.

const RECORDED_SOURCES = ['gps', 'logged'];

export async function leaderboard(challenge: Challenge): Promise<LeaderboardRow[]> {
  const participants = await db
    .select({ user: users, completedAt: challengeParticipants.completedAt })
    .from(challengeParticipants)
    .innerJoin(users, eq(users.id, challengeParticipants.userId))
    .where(and(eq(challengeParticipants.challengeId, challenge.id), isNull(users.suspendedAt)));
  if (participants.length === 0) return [];

  const rows = await db
    .select({ workout: workouts, verified: workoutShares.verified, hidden: workoutShares.hidden })
    .from(workouts)
    .leftJoin(workoutShares, eq(workoutShares.workoutId, workouts.id))
    .where(
      and(
        inArray(workouts.userId, participants.map((p) => p.user.id)),
        isNull(workouts.deletedAt),
        gte(workouts.startedAt, challenge.startsAt.getTime()),
        lte(workouts.startedAt, challenge.endsAt.getTime()),
      ),
    );

  const typeMatches = (type: string, cardioOnly: boolean) =>
    challenge.activityTypes.length > 0
      ? challenge.activityTypes.includes(type)
      : !cardioOnly || type !== 'strength';

  const totals = new Map<string, { distanceM: number; durationS: number; count: number; volumeKg: number; strengthSessions: number }>();
  for (const p of participants) {
    totals.set(p.user.id, { distanceM: 0, durationS: 0, count: 0, volumeKg: 0, strengthSessions: 0 });
  }
  for (const { workout, verified, hidden } of rows) {
    if (hidden) continue;
    const total = totals.get(workout.userId);
    if (!total) continue;
    const recorded = RECORDED_SOURCES.includes(workout.source);
    const allowed = recorded || challenge.allowManual;

    if (verified && workout.type !== 'strength' && typeMatches(workout.type, true)) {
      total.distanceM += workout.distanceM ?? 0;
    }
    if (allowed && typeMatches(workout.type, false)) {
      total.durationS += workout.movingS ?? 0;
      total.count += 1;
    }
    if (workout.type === 'strength' && recorded) {
      total.volumeKg += workout.volumeKg ?? 0;
      total.strengthSessions += 1;
    }
  }

  const ratio = (value: number, target: number | null) => (target && target > 0 ? value / target : 0);
  const board = participants.map(({ user, completedAt }): LeaderboardRow => {
    const t = totals.get(user.id)!;
    const progress =
      challenge.kind === 'distance'
        ? ratio(t.distanceM, challenge.targetDistanceM)
        : challenge.kind === 'duration'
          ? ratio(t.durationS, challenge.targetDurationS)
          : challenge.kind === 'count'
            ? ratio(t.count, challenge.targetCount)
            : challenge.kind === 'volume'
              ? ratio(t.volumeKg, challenge.targetVolumeKg)
              : Math.min(
                  ratio(t.distanceM, challenge.targetDistanceM),
                  ratio(t.strengthSessions, challenge.targetStrengthSessions),
                );
    return {
      user: toPublicUser(user),
      progress: Math.min(1, progress),
      ...t,
      completed: completedAt !== null || progress >= 1,
    };
  });
  return board.sort((a, b) => b.progress - a.progress || b.distanceM - a.distanceM || b.count - a.count);
}

/** Awards the completion badge the first time someone's progress reaches 100%. */
async function recordCompletions(challenge: Challenge, board: LeaderboardRow[]) {
  for (const row of board) {
    if (row.progress < 1) continue;
    const updated = await db
      .update(challengeParticipants)
      .set({ completedAt: new Date() })
      .where(
        and(
          eq(challengeParticipants.challengeId, challenge.id),
          eq(challengeParticipants.userId, row.user.id),
          isNull(challengeParticipants.completedAt),
        ),
      )
      .returning();
    if (updated.length > 0) {
      await notify({ userId: row.user.id, type: 'challenge_completed', challengeId: challenge.id });
    }
  }
}

// After an upload, update completion for any running challenge the person is in.
onWorkoutSavedListener(async (workout: Workout) => {
  const running = await db
    .select({ challenge: challenges })
    .from(challengeParticipants)
    .innerJoin(challenges, eq(challenges.id, challengeParticipants.challengeId))
    .where(
      and(
        eq(challengeParticipants.userId, workout.userId),
        lte(challenges.startsAt, new Date()),
        gte(challenges.endsAt, new Date(Date.now() - 24 * 60 * 60 * 1000)),
      ),
    );
  for (const { challenge } of running) {
    await recordCompletions(challenge, await leaderboard(challenge));
  }
});

// --- Routes ----------------------------------------------------------------------------

challengesRouter.get('/challenges', async (req, res) => {
  const me = currentUser(req);
  const rows = await db
    .select()
    .from(challenges)
    .where(
      or(
        sql`exists (select 1 from challenge_participants p where p.challenge_id = ${challenges.id} and p.user_id = ${me.id})`,
        sql`exists (select 1 from club_members m where m.club_id = ${challenges.clubId} and m.user_id = ${me.id})`,
      ),
    )
    .orderBy(desc(challenges.endsAt))
    .limit(50);
  res.json({ challenges: await Promise.all(rows.map((row) => toSummary(row, me.id))) });
});

/** Release 4: public challenges anyone can join, featured ones first. */
challengesRouter.get('/challenges/public', async (req, res) => {
  const me = currentUser(req);
  const rows = await db
    .select()
    .from(challenges)
    .where(and(eq(challenges.isPublic, true), gte(challenges.endsAt, new Date())))
    .orderBy(desc(challenges.featured), desc(challenges.createdAt))
    .limit(50);
  res.json({ challenges: await Promise.all(rows.map((row) => toSummary(row, me.id))) });
});

const createSchema = z
  .object({
    title: z.string().trim().min(3).max(80),
    kind: z.enum(['distance', 'duration', 'count', 'volume', 'hybrid']),
    activityTypes: z.array(z.string().max(20)).max(6).default([]),
    targetDistanceM: z.number().positive().nullable().default(null),
    targetDurationS: z.number().int().positive().nullable().default(null),
    targetCount: z.number().int().positive().nullable().default(null),
    targetVolumeKg: z.number().positive().nullable().default(null),
    targetStrengthSessions: z.number().int().positive().nullable().default(null),
    startsAt: z.number(),
    endsAt: z.number(),
    timezone: z.string().max(64),
    clubId: z.uuid().nullable().default(null),
    allowManual: z.boolean().default(false),
    isPublic: z.boolean().default(false),
  })
  .refine((body) => body.endsAt > body.startsAt, { message: 'The end must be after the start.' });

challengesRouter.post('/challenges', async (req, res) => {
  const me = currentUser(req);
  requireUsername(me);
  const body = parse(createSchema, req.body);
  assertClean(body.title, 'title');
  if (body.clubId) {
    const member = await clubMembership(body.clubId, me.id);
    if (!member) throw forbidden('Only club members can start a club challenge.');
  }
  if (body.isPublic && !isPro(me.proUntil)) {
    throw new HttpError(402, 'pro_required', 'Public challenges are a LiveFit Pro feature.');
  }
  const [challenge] = await db
    .insert(challenges)
    .values({
      ...body,
      creatorId: me.id,
      startsAt: new Date(body.startsAt),
      endsAt: new Date(body.endsAt),
      inviteCode: inviteCode(),
    })
    .returning();
  await db.insert(challengeParticipants).values({ challengeId: challenge.id, userId: me.id });

  if (challenge.clubId) {
    const members = await db
      .select({ userId: clubMembers.userId })
      .from(clubMembers)
      .where(eq(clubMembers.clubId, challenge.clubId));
    for (const member of members) {
      await notify({
        userId: member.userId,
        type: 'challenge_started',
        actorId: me.id,
        clubId: challenge.clubId,
        challengeId: challenge.id,
      });
    }
  }
  res.status(201).json(await toSummary(challenge, me.id));
});

challengesRouter.post('/challenges/join', async (req, res) => {
  const me = currentUser(req);
  requireUsername(me);
  const { code } = parse(z.object({ code: z.string().trim().min(4).max(16) }), req.body);
  const [challenge] = await db
    .select()
    .from(challenges)
    .where(eq(challenges.inviteCode, code.toUpperCase()));
  if (!challenge) throw notFound('No challenge has that code.');
  await db
    .insert(challengeParticipants)
    .values({ challengeId: challenge.id, userId: me.id })
    .onConflictDoNothing();
  res.json(await toSummary(challenge, me.id));
});

challengesRouter.get('/challenges/:id', async (req, res) => {
  const me = currentUser(req);
  const challenge = await visibleChallenge(String(req.params.id), me.id);
  const board = await leaderboard(challenge);
  await recordCompletions(challenge, board);
  res.json({ challenge: await toSummary(challenge, me.id), leaderboard: board });
});

challengesRouter.post('/challenges/:id/join', async (req, res) => {
  const me = currentUser(req);
  requireUsername(me);
  const challenge = await visibleChallenge(String(req.params.id), me.id);
  await db
    .insert(challengeParticipants)
    .values({ challengeId: challenge.id, userId: me.id })
    .onConflictDoNothing();
  res.json(await toSummary(challenge, me.id));
});

challengesRouter.delete('/challenges/:id/join', async (req, res) => {
  const me = currentUser(req);
  await db
    .delete(challengeParticipants)
    .where(
      and(
        eq(challengeParticipants.challengeId, String(req.params.id)),
        eq(challengeParticipants.userId, me.id),
      ),
    );
  res.status(204).end();
});

/** Moderators can feature a public challenge (Release 4). */
challengesRouter.post('/admin/challenges/:id/feature', requireAdmin, async (req, res) => {
  const { featured } = parse(z.object({ featured: z.boolean() }), req.body);
  await db
    .update(challenges)
    .set({ featured })
    .where(eq(challenges.id, String(req.params.id)));
  res.status(204).end();
});

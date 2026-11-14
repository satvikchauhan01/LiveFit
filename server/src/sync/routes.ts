import { and, asc, eq, gt, isNull, sql } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';

import type {
  PullResponse,
  PushResponse,
  SyncDoc,
  SyncDocKind,
  WorkoutDoc,
} from '../../../shared/api';
import { currentUser, requireAuth } from '../auth/middleware';
import { db } from '../db/client';
import { userDocs, type Workout, workouts } from '../db/schema';
import { parse } from '../lib/http';
import { onWorkoutSaved } from './hooks';

// Sync works like a mailbox in each direction:
// - Push: the phone sends whatever changed since it last synced. Every write is
//   an "upsert" keyed by the phone-made UUID, so sending the same thing twice
//   (after a dropped connection, say) never creates a duplicate.
// - Pull: the phone asks for everything with a change number above the last one
//   it saw, page by page.
// When the same thing was edited in two places, the newer `updatedAt` wins.

export const syncRouter = Router();
syncRouter.use(requireAuth);

const nullableNumber = z.number().nullable();

const workoutSchema = z.object({
  id: z.uuid(),
  type: z.string().max(20),
  source: z.string().max(20),
  startedAt: z.number(),
  endedAt: nullableNumber,
  timezone: z.string().max(64),
  elapsedS: nullableNumber,
  movingS: nullableNumber,
  distanceM: nullableNumber,
  volumeKg: nullableNumber,
  elevationGainM: nullableNumber,
  caloriesEst: nullableNumber,
  autoPause: z.boolean(),
  title: z.string().max(200),
  notes: z.string().max(5000),
  visibility: z.enum(['only_me', 'followers', 'club', 'public']),
  extras: z.record(z.string(), z.unknown()),
  updatedAt: z.number(),
  detail: z.object({
    points: z.array(
      z.tuple([
        z.number(),
        z.number(),
        z.number(),
        nullableNumber,
        nullableNumber,
        nullableNumber,
        z.union([z.literal(0), z.literal(1)]),
      ]),
    ),
    pauses: z.array(z.object({ startedAt: z.number(), endedAt: nullableNumber })),
    laps: z.array(z.number()),
    sets: z.array(
      z.object({
        exerciseId: z.string().max(64),
        exerciseOrder: z.number(),
        setIndex: z.number(),
        reps: nullableNumber,
        weightKg: nullableNumber,
        durationS: nullableNumber,
        completedAt: nullableNumber,
      }),
    ),
  }),
});

const docSchema = z.object({
  kind: z.enum(['profile', 'exercise', 'goal', 'routine', 'plan_enrollment']),
  id: z.string().min(1).max(64),
  body: z.record(z.string(), z.unknown()),
  updatedAt: z.number(),
  deleted: z.boolean(),
});

const pushSchema = z.object({
  workouts: z.array(workoutSchema).max(50),
  deletedWorkouts: z.array(z.object({ id: z.uuid(), deletedAt: z.number() })).max(500),
  docs: z.array(docSchema).max(500),
});

const nextChange = sql`nextval('sync_change_seq')`;

syncRouter.post('/push', async (req, res) => {
  const user = currentUser(req);
  const body = parse(pushSchema, req.body);
  const savedWorkoutIds: string[] = [];

  for (const doc of body.workouts) {
    // Insert the workout; if it's already there (a retry), only take the editable
    // fields, and only if this edit is newer. The WHERE on user_id means one
    // account can never overwrite another account's workout.
    const rows = await db
      .insert(workouts)
      .values({ ...doc, userId: user.id })
      .onConflictDoUpdate({
        target: workouts.id,
        set: {
          title: sql`excluded.title`,
          notes: sql`excluded.notes`,
          visibility: sql`excluded.visibility`,
          extras: sql`excluded.extras`,
          updatedAt: sql`excluded.updated_at`,
          changeSeq: nextChange,
        },
        setWhere: sql`${workouts.userId} = ${user.id} and excluded.updated_at > ${workouts.updatedAt} and ${workouts.deletedAt} is null`,
      })
      .returning();

    const [owner] = rows.length
      ? rows
      : await db.select().from(workouts).where(eq(workouts.id, doc.id));
    if (owner?.userId === user.id) {
      savedWorkoutIds.push(doc.id);
      if (rows.length) await onWorkoutSaved(owner);
    }
  }

  for (const deleted of body.deletedWorkouts) {
    // Keep the row as a "tombstone" so other devices learn about the delete,
    // but drop the heavy route data straight away.
    await db
      .update(workouts)
      .set({
        deletedAt: deleted.deletedAt,
        detail: { points: [], pauses: [], laps: [], sets: [] },
        changeSeq: nextChange,
      })
      .where(
        and(eq(workouts.id, deleted.id), eq(workouts.userId, user.id), isNull(workouts.deletedAt)),
      );
  }

  for (const doc of body.docs) {
    await db
      .insert(userDocs)
      .values({ ...doc, userId: user.id })
      .onConflictDoUpdate({
        target: [userDocs.userId, userDocs.kind, userDocs.id],
        set: {
          body: sql`excluded.body`,
          updatedAt: sql`excluded.updated_at`,
          deleted: sql`excluded.deleted`,
          changeSeq: nextChange,
        },
        setWhere: sql`excluded.updated_at > ${userDocs.updatedAt}`,
      });
  }

  res.json({ savedWorkoutIds } satisfies PushResponse);
});

/** Workouts are big (routes), so they come in smaller pages than documents. */
const PAGE_SIZE = 25;

export function toWorkoutDoc(workout: Workout): WorkoutDoc {
  return {
    id: workout.id,
    type: workout.type,
    source: workout.source,
    startedAt: workout.startedAt,
    endedAt: workout.endedAt,
    timezone: workout.timezone,
    elapsedS: workout.elapsedS,
    movingS: workout.movingS,
    distanceM: workout.distanceM,
    volumeKg: workout.volumeKg,
    elevationGainM: workout.elevationGainM,
    caloriesEst: workout.caloriesEst,
    autoPause: workout.autoPause,
    title: workout.title,
    notes: workout.notes,
    visibility: workout.visibility,
    extras: workout.extras,
    updatedAt: workout.updatedAt,
    detail: workout.detail,
  };
}

syncRouter.get('/pull', async (req, res) => {
  const user = currentUser(req);
  const { cursor } = parse(z.object({ cursor: z.coerce.number().int().min(0).default(0) }), req.query);

  const [workoutRows, docRows] = await Promise.all([
    db
      .select()
      .from(workouts)
      .where(and(eq(workouts.userId, user.id), gt(workouts.changeSeq, cursor)))
      .orderBy(asc(workouts.changeSeq))
      .limit(PAGE_SIZE + 1),
    db
      .select()
      .from(userDocs)
      .where(and(eq(userDocs.userId, user.id), gt(userDocs.changeSeq, cursor)))
      .orderBy(asc(userDocs.changeSeq))
      .limit(PAGE_SIZE * 20 + 1),
  ]);

  // Both tables share one change sequence. Merge them in change order and stop
  // at the page size, so the returned cursor never skips anything.
  type Change =
    | { seq: number; workout: Workout }
    | { seq: number; doc: (typeof docRows)[number] };
  const changes: Change[] = [
    ...workoutRows.map((workout) => ({ seq: workout.changeSeq, workout })),
    ...docRows.map((doc) => ({ seq: doc.changeSeq, doc })),
  ].sort((a, b) => a.seq - b.seq);

  let workoutCount = 0;
  const page: Change[] = [];
  for (const change of changes) {
    if ('workout' in change && ++workoutCount > PAGE_SIZE) break;
    if (page.length >= PAGE_SIZE * 20) break;
    page.push(change);
  }
  const truncatedLists =
    workoutRows.length > PAGE_SIZE || docRows.length > PAGE_SIZE * 20;
  const hasMore = page.length < changes.length || truncatedLists;

  const response: PullResponse = {
    workouts: [],
    deletedWorkoutIds: [],
    docs: [],
    cursor: String(page.length ? page[page.length - 1].seq : cursor),
    hasMore,
  };
  for (const change of page) {
    if ('workout' in change) {
      if (change.workout.deletedAt) response.deletedWorkoutIds.push(change.workout.id);
      else response.workouts.push(toWorkoutDoc(change.workout));
    } else {
      const doc: SyncDoc = {
        kind: change.doc.kind as SyncDocKind,
        id: change.doc.id,
        body: change.doc.body,
        updatedAt: change.doc.updatedAt,
        deleted: change.doc.deleted,
      };
      response.docs.push(doc);
    }
  }
  res.json(response);
});

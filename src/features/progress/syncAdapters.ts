import { eq } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';

import type { SyncDoc, SyncDocKind } from '@shared/api';

import { db } from '@/db/client';
import { goals, planEnrollments, routines } from '@/db/schema';
import { registerDocAdapter } from '@/features/sync/docAdapters';

// Goals, routines and plan enrolments sync as small whole documents.
// They all have id, updatedAt, deletedAt and dirty columns, so one helper covers them.

type SyncedTable = typeof goals | typeof routines | typeof planEnrollments;

function register(kind: SyncDocKind, table: SyncedTable, bodyFields: string[]) {
  // Drizzle's column helpers are typed per table; this helper only touches the
  // shared columns (id, updatedAt, deletedAt, dirty), so a loose type is fine here.
  const t = table as unknown as SQLiteTable &
    Record<string, never> & {
      id: typeof goals.id;
      updatedAt: typeof goals.updatedAt;
      dirty: typeof goals.dirty;
    };

  registerDocAdapter({
    kind,
    collectDirty: async () => {
      const rows = (await db.select().from(t).where(eq(t.dirty, true))) as Record<
        string,
        unknown
      >[];
      return rows.map((row): SyncDoc => ({
        kind,
        id: String(row.id),
        body: Object.fromEntries(bodyFields.map((field) => [field, row[field] ?? null])),
        updatedAt: Number(row.updatedAt),
        deleted: row.deletedAt !== null && row.deletedAt !== undefined,
      }));
    },
    markUploaded: async (doc) => {
      const rows = (await db.select().from(t).where(eq(t.id, doc.id))) as Record<string, unknown>[];
      if (rows[0] && Number(rows[0].updatedAt) === doc.updatedAt) {
        await db
          .update(t)
          .set({ dirty: false } as never)
          .where(eq(t.id, doc.id));
      }
    },
    apply: async (doc) => {
      const rows = (await db.select().from(t).where(eq(t.id, doc.id))) as Record<string, unknown>[];
      const local = rows[0];
      if (local && Number(local.updatedAt) >= doc.updatedAt) return false;
      const values = {
        ...Object.fromEntries(bodyFields.map((field) => [field, doc.body[field] ?? null])),
        updatedAt: doc.updatedAt,
        deletedAt: doc.deleted ? doc.updatedAt : null,
        dirty: false,
      };
      if (local) {
        await db
          .update(t)
          .set(values as never)
          .where(eq(t.id, doc.id));
      } else {
        await db.insert(t).values({ id: doc.id, createdAt: doc.updatedAt, ...values } as never);
      }
      return true;
    },
  });
}

register('goal', goals, ['kind', 'target', 'activityType', 'exerciseId', 'lastAchievedPeriod']);
register('routine', routines, ['name', 'items']);
register('plan_enrollment', planEnrollments, ['planId', 'startWeek', 'endedAt']);

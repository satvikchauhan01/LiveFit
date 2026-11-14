import { and, eq } from 'drizzle-orm';

import type { SyncDoc, SyncDocKind } from '@shared/api';

import { db } from '@/db/client';
import { EQUIPMENT, exercises, LOG_TYPES, MUSCLE_GROUPS, profile } from '@/db/schema';

/**
 * How one kind of small document syncs: find what changed here, mark it
 * uploaded, and apply a newer copy from the server. New kinds (goals, routines,
 * plans) register an adapter with `registerDocAdapter`.
 */
export type DocAdapter = {
  kind: SyncDocKind;
  collectDirty: () => Promise<SyncDoc[]>;
  /** Clear "needs upload", unless edited again since `updatedAt`. */
  markUploaded: (doc: SyncDoc) => Promise<void>;
  /** Returns true if something on the phone changed. */
  apply: (doc: SyncDoc) => Promise<boolean>;
};

const adapters = new Map<SyncDocKind, DocAdapter>();

export function registerDocAdapter(adapter: DocAdapter): void {
  adapters.set(adapter.kind, adapter);
}

export function docAdapters(): DocAdapter[] {
  return [...adapters.values()];
}

export function adapterFor(kind: SyncDocKind): DocAdapter | undefined {
  return adapters.get(kind);
}

// --- Profile settings ----------------------------------------------------------------

/** The settings that follow you between devices. Onboarding state stays per phone. */
const PROFILE_FIELDS = [
  'displayName',
  'distanceUnit',
  'weightUnit',
  'weightKg',
  'weeklyGoal',
  'restSeconds',
  'autoPause',
  'voiceCues',
  'reminderDays',
  'reminderMinutes',
  'analyticsEnabled',
] as const;

registerDocAdapter({
  kind: 'profile',
  collectDirty: async () => {
    const [row] = await db.select().from(profile).where(eq(profile.dirty, true));
    if (!row) return [];
    const body = Object.fromEntries(PROFILE_FIELDS.map((field) => [field, row[field]]));
    return [{ kind: 'profile', id: 'me', body, updatedAt: row.updatedAt, deleted: false }];
  },
  markUploaded: async (doc) => {
    await db.update(profile).set({ dirty: false }).where(eq(profile.updatedAt, doc.updatedAt));
  },
  apply: async (doc) => {
    const [row] = await db.select().from(profile);
    if (!row || (row.dirty && row.updatedAt >= doc.updatedAt) || doc.updatedAt <= row.updatedAt) {
      return false;
    }
    const changes: Record<string, unknown> = {};
    for (const field of PROFILE_FIELDS) {
      if (field in doc.body) changes[field] = doc.body[field];
    }
    await db
      .update(profile)
      .set({ ...changes, updatedAt: doc.updatedAt, dirty: false })
      .where(eq(profile.id, row.id));
    return true;
  },
});

// --- Custom exercises -------------------------------------------------------------------

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

registerDocAdapter({
  kind: 'exercise',
  collectDirty: async () => {
    const rows = await db
      .select()
      .from(exercises)
      .where(and(eq(exercises.dirty, true), eq(exercises.isCustom, true)));
    return rows.map((row) => ({
      kind: 'exercise',
      id: row.id,
      body: {
        name: row.name,
        muscleGroup: row.muscleGroup,
        equipment: row.equipment,
        logType: row.logType,
      },
      updatedAt: row.updatedAt,
      deleted: row.deletedAt !== null,
    }));
  },
  markUploaded: async (doc) => {
    await db
      .update(exercises)
      .set({ dirty: false })
      .where(and(eq(exercises.id, doc.id), eq(exercises.updatedAt, doc.updatedAt)));
  },
  apply: async (doc) => {
    const [row] = await db.select().from(exercises).where(eq(exercises.id, doc.id));
    if (row && ((row.dirty && row.updatedAt >= doc.updatedAt) || doc.updatedAt <= row.updatedAt)) {
      return false;
    }
    const values = {
      name: typeof doc.body.name === 'string' ? doc.body.name : 'Exercise',
      muscleGroup: pick(doc.body.muscleGroup, MUSCLE_GROUPS, 'full_body'),
      equipment: pick(doc.body.equipment, EQUIPMENT, 'other'),
      logType: pick(doc.body.logType, LOG_TYPES, 'weight_reps'),
      updatedAt: doc.updatedAt,
      deletedAt: doc.deleted ? doc.updatedAt : null,
      dirty: false,
    };
    await db
      .insert(exercises)
      .values({ id: doc.id, isCustom: true, createdAt: Date.now(), ...values })
      .onConflictDoUpdate({ target: exercises.id, set: values });
    return true;
  },
});

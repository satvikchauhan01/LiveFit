import { eq } from 'drizzle-orm';

import { db } from '@/db/client';
import { type Profile, profile } from '@/db/schema';
import { notifyLocalChange } from '@/features/sync/changes';

// There is only ever one local profile row.
const PROFILE_ID = 1;

export type ProfileChanges = Partial<
  Pick<
    Profile,
    | 'displayName'
    | 'distanceUnit'
    | 'weightUnit'
    | 'weightKg'
    | 'onboardedAt'
    | 'weeklyGoal'
    | 'restSeconds'
    | 'autoPause'
    | 'voiceCues'
    | 'reminderDays'
    | 'reminderMinutes'
    | 'analyticsEnabled'
  >
>;

/** Reads the profile, creating it with defaults on first launch. */
export async function loadProfile(): Promise<Profile> {
  const existing = await db.select().from(profile).where(eq(profile.id, PROFILE_ID));
  if (existing[0]) {
    return existing[0];
  }

  const now = Date.now();
  const created = await db
    .insert(profile)
    .values({ id: PROFILE_ID, createdAt: now, updatedAt: now })
    .returning();
  return created[0]!;
}

/** Settings that only matter on this phone, so changing them doesn't need a sync. */
const LOCAL_ONLY: (keyof ProfileChanges)[] = ['onboardedAt'];

export async function saveProfile(changes: ProfileChanges): Promise<Profile> {
  const synced = Object.keys(changes).some(
    (key) => !LOCAL_ONLY.includes(key as keyof ProfileChanges),
  );
  const updated = await db
    .update(profile)
    .set({ ...changes, ...(synced ? { dirty: true } : {}), updatedAt: Date.now() })
    .where(eq(profile.id, PROFILE_ID))
    .returning();
  if (synced) notifyLocalChange();
  return updated[0]!;
}

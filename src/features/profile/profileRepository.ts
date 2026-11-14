import { eq } from 'drizzle-orm';

import { db } from '@/db/client';
import { type Profile, profile } from '@/db/schema';

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

export async function saveProfile(changes: ProfileChanges): Promise<Profile> {
  const updated = await db
    .update(profile)
    .set({ ...changes, updatedAt: Date.now() })
    .where(eq(profile.id, PROFILE_ID))
    .returning();
  return updated[0]!;
}

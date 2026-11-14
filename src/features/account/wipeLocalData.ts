import { eq, ne } from 'drizzle-orm';

import { db } from '@/db/client';
import { exercises, workouts } from '@/db/schema';

/**
 * Removes finished workouts and custom exercises from this phone (after signing
 * out, when the user chooses not to keep a copy). A workout in progress and the
 * profile settings stay.
 */
export async function wipeLocalWorkouts(): Promise<void> {
  // ON DELETE CASCADE removes routes, pauses, laps and sets with each workout.
  await db.delete(workouts).where(ne(workouts.status, 'active'));
  await db.delete(exercises).where(eq(exercises.isCustom, true));
}

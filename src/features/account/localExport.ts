import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { and, eq, isNull } from 'drizzle-orm';

import { db } from '@/db/client';
import { exercises, profile, workouts } from '@/db/schema';
import { toWorkoutDoc } from '@/features/sync/syncRepository';

/**
 * Everything LiveFit stores on this phone, as one JSON file shared through the
 * share sheet: profile, every workout (with its route, pauses, laps and sets)
 * and custom exercises. Works with or without an account.
 */
export async function exportLocalData(): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }

  const [profileRow] = await db.select().from(profile);
  const finished = await db
    .select()
    .from(workouts)
    .where(and(eq(workouts.status, 'finished'), isNull(workouts.deletedAt)));
  const custom = await db.select().from(exercises).where(eq(exercises.isCustom, true));

  const data = {
    exportedAt: new Date().toISOString(),
    format: 'livefit-export-1',
    profile: profileRow,
    customExercises: custom,
    workouts: await Promise.all(finished.map(toWorkoutDoc)),
  };

  const stamp = new Date().toISOString().slice(0, 10);
  const file = new File(Paths.cache, `livefit-export-${stamp}.json`);
  if (file.exists) file.delete();
  file.create();
  await file.write(JSON.stringify(data, null, 2));
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Export data' });
}

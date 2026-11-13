import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import type { Workout } from '@/db/schema';

import { buildGpx } from './gpx';
import type { PauseInterval, TrackPoint } from './types';

function fileStamp(ms: number): string {
  // 2026-11-13T07:05:09.000Z → 2026-11-13_07-05-09
  return new Date(ms).toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '-');
}

/** Writes the workout to a .gpx file in the cache folder and opens the share sheet. */
export async function shareWorkoutAsGpx(
  workout: Workout,
  points: TrackPoint[],
  pauses: PauseInterval[],
): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }

  const file = new File(Paths.cache, `livefit-${workout.type}-${fileStamp(workout.startedAt)}.gpx`);
  if (file.exists) {
    file.delete();
  }
  file.create();
  await file.write(
    buildGpx({
      name: workout.title || `LiveFit ${workout.type}`,
      activity: workout.type,
      startedAt: workout.startedAt,
      endedAt: workout.endedAt,
      pauses,
      points,
    }),
  );

  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/gpx+xml',
    dialogTitle: 'Export GPX',
  });
}

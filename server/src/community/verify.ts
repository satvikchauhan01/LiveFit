import type { Workout } from '../db/schema';
import { distanceM, type LatLng } from './geo';

// Fair play (plan §8.3). A workout only counts on distance leaderboards when the
// server, not the phone, is happy with it:
// - it was recorded with GPS in the app (not typed in, not imported);
// - no fix came from a mock-location app;
// - no 1 km stretch is faster than the activity allows;
// - no "teleport" (a jump that would need an impossible speed);
// - the server's own distance roughly agrees with the phone's.

/** Fastest believable average over any kilometre, in m/s. */
const MAX_KM_SPEED_MPS: Record<string, number> = {
  run: 25 / 3.6,
  walk: 10 / 3.6,
  hike: 12 / 3.6,
  wheelchair: 40 / 3.6,
  cycle: 80 / 3.6,
};
const TELEPORT_SPEED_MPS = 60;
const MAX_ACCURACY_M = 25;

export type Verification = {
  verified: boolean;
  flags: string[];
  /** Distance measured here from the raw points (accurate fixes only). */
  serverDistanceM: number | null;
};

export function verifyWorkout(workout: Workout): Verification {
  const flags: string[] = [];
  if (workout.source !== 'gps') flags.push(`source_${workout.source}`);

  const points = workout.detail.points;
  if (points.some((point) => point[6] === 1)) flags.push('mock_location');

  const pauses = workout.detail.pauses;
  const paused = (t: number) =>
    pauses.some((pause) => t >= pause.startedAt && (pause.endedAt === null || t < pause.endedAt));
  const kept = points.filter(
    (point) => point[4] !== null && point[4] <= MAX_ACCURACY_M && !paused(point[0]),
  );

  let total = 0;
  const cumulative: { t: number; d: number }[] = [];
  for (let i = 0; i < kept.length; i += 1) {
    if (i > 0) {
      const from: LatLng = [kept[i - 1][1], kept[i - 1][2]];
      const to: LatLng = [kept[i][1], kept[i][2]];
      const step = distanceM(from, to);
      const seconds = (kept[i][0] - kept[i - 1][0]) / 1000;
      if (seconds > 0 && step / seconds > TELEPORT_SPEED_MPS && !flags.includes('teleport')) {
        flags.push('teleport');
      }
      total += step;
    }
    cumulative.push({ t: kept[i][0], d: total });
  }

  // Fastest kilometre, with a sliding window.
  const limit = MAX_KM_SPEED_MPS[workout.type];
  if (limit !== undefined) {
    let start = 0;
    for (let end = 1; end < cumulative.length; end += 1) {
      while (start + 1 < end && cumulative[end].d - cumulative[start + 1].d >= 1000) start += 1;
      const covered = cumulative[end].d - cumulative[start].d;
      const seconds = (cumulative[end].t - cumulative[start].t) / 1000;
      if (covered >= 1000 && seconds > 0 && covered / seconds > limit) {
        flags.push('too_fast');
        break;
      }
    }
  }

  const serverDistanceM = kept.length > 1 ? total : null;
  // Raw points zig-zag more than the phone's smoothed route; allow 15% either way.
  if (serverDistanceM !== null && workout.distanceM) {
    const ratio = workout.distanceM / serverDistanceM;
    if (ratio > 1.15 || ratio < 0.7) flags.push('distance_mismatch');
  }

  return { verified: flags.length === 0 && serverDistanceM !== null, flags, serverDistanceM };
}

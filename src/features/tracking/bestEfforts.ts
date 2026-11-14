import type { WorkoutTrack } from './pipeline';

/** The distances records are kept for, in metres. */
export const BEST_EFFORT_DISTANCES = [1000, 5000, 10_000, 21_097.5] as const;

export const BEST_EFFORT_LABEL: Record<number, string> = {
  1000: '1 km',
  5000: '5 km',
  10_000: '10 km',
  21_097.5: 'Half marathon',
};

/** Fastest moving time (ms) for each distance covered, e.g. { "5000": 1_512_000 }. */
export type BestEfforts = Record<string, number>;

/**
 * The fastest stretch of each standard distance anywhere inside the workout,
 * not just from the start: a 7 km run can hold your fastest 5 km.
 *
 * Two pointers slide along the route: for each end point, the start moves up as
 * far as it can while still covering the distance. The time is scaled to exactly
 * the distance (a stretch of 5,004 m is counted as 5,000 m at the same pace).
 */
export function bestEfforts(track: WorkoutTrack): BestEfforts {
  const path = track.segments.flat();
  const result: BestEfforts = {};

  for (const distance of BEST_EFFORT_DISTANCES) {
    if (track.distanceM < distance) break;
    let best = Infinity;
    let start = 0;
    for (let end = 1; end < path.length; end += 1) {
      while (start + 1 < end && path[end].distanceM - path[start + 1].distanceM >= distance) {
        start += 1;
      }
      const covered = path[end].distanceM - path[start].distanceM;
      if (covered >= distance) {
        const time = ((path[end].movingMs - path[start].movingMs) * distance) / covered;
        if (time > 0) best = Math.min(best, time);
      }
    }
    if (Number.isFinite(best)) {
      result[String(distance)] = Math.round(best);
    }
  }
  return result;
}

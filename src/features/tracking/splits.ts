import { GPS_SETTINGS } from './config';
import { paceSecondsPerKm } from './geo';
import type { PathPoint, WorkoutTrack } from './pipeline';

export type Split = {
  /** 1 for the first kilometre/mile. */
  index: number;
  distanceM: number;
  durationMs: number;
  paceSecPerKm: number | null;
  /** True for the last split, which is usually shorter than a full one. */
  partial: boolean;
};

export type SplitResult = {
  completed: Split[];
  /** The split in progress (while recording) or the leftover at the end. */
  current: Split;
};

function makeSplit(index: number, distanceM: number, durationMs: number, partial: boolean): Split {
  return {
    index,
    distanceM,
    durationMs,
    paceSecPerKm: paceSecondsPerKm(distanceM, durationMs),
    partial,
  };
}

/**
 * Cuts the route into equal splits (1000 m for km, 1609.344 m for miles).
 * GPS points rarely land exactly on a boundary, so the moment each boundary was
 * crossed is interpolated between the points either side of it.
 */
export function computeSplits(track: WorkoutTrack, splitLengthM: number): SplitResult {
  const completed: Split[] = [];
  let boundaryM = splitLengthM;
  let lastBoundaryMs = 0;
  let previous: PathPoint | null = null;

  for (const segment of track.segments) {
    for (const point of segment) {
      // Across a pause the distance doesn't grow, so no boundary can be crossed there.
      while (previous && point.distanceM >= boundaryM && point.distanceM > previous.distanceM) {
        const fraction = (boundaryM - previous.distanceM) / (point.distanceM - previous.distanceM);
        const crossedAtMs = previous.activeMs + fraction * (point.activeMs - previous.activeMs);
        completed.push(
          makeSplit(completed.length + 1, splitLengthM, crossedAtMs - lastBoundaryMs, false),
        );
        lastBoundaryMs = crossedAtMs;
        boundaryM += splitLengthM;
      }
      previous = point;
    }
  }

  const current = makeSplit(
    completed.length + 1,
    track.distanceM - (boundaryM - splitLengthM),
    Math.max(0, track.movingMs - lastBoundaryMs),
    true,
  );
  return { completed, current };
}

/** Splits to show on a summary: the full ones, plus the leftover if it's long enough to matter. */
export function splitsForSummary({ completed, current }: SplitResult): Split[] {
  return current.distanceM >= GPS_SETTINGS.minPartialSplitM ? [...completed, current] : completed;
}

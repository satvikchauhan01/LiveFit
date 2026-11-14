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

export function makeSplit(
  index: number,
  distanceM: number,
  durationMs: number,
  partial: boolean,
): Split {
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
        const crossedAtMs = previous.movingMs + fraction * (point.movingMs - previous.movingMs);
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

/** Distance and moving time at the last fix at or before `t` (at most a second out). */
function progressAt(track: WorkoutTrack, t: number): { distanceM: number; movingMs: number } {
  let progress = { distanceM: 0, movingMs: 0 };
  for (const segment of track.segments) {
    for (const point of segment) {
      if (point.t > t) return progress;
      progress = { distanceM: point.distanceM, movingMs: point.movingMs };
    }
  }
  return progress;
}

/**
 * Manual laps: one lap per Lap press, plus the stretch from the last press to
 * the end (or to now, while recording), which is the lap in progress.
 * No presses means no laps.
 */
export function computeLaps(track: WorkoutTrack, lapTimes: number[]): Split[] {
  if (lapTimes.length === 0) {
    return [];
  }
  const boundaries = [...lapTimes].sort((a, b) => a - b).map((t) => progressAt(track, t));
  boundaries.push({ distanceM: track.distanceM, movingMs: track.movingMs });

  let previous = { distanceM: 0, movingMs: 0 };
  return boundaries.map((boundary, i) => {
    const lap = makeSplit(
      i + 1,
      boundary.distanceM - previous.distanceM,
      Math.max(0, boundary.movingMs - previous.movingMs),
      i === boundaries.length - 1,
    );
    previous = boundary;
    return lap;
  });
}

/** Splits to show on a summary: the full ones, plus the leftover if it's long enough to matter. */
export function splitsForSummary({ completed, current }: SplitResult): Split[] {
  return current.distanceM >= GPS_SETTINGS.minPartialSplitM ? [...completed, current] : completed;
}

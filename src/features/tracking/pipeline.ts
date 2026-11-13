import type { ActivityType } from '@/db/schema';

import { GPS_SETTINGS, MAX_SPEED_MPS } from './config';
import { haversineMeters, paceSecondsPerKm } from './geo';
import { activeMsAt, isPausedAt, pausedMsBetween } from './pauses';
import type { PauseInterval, TrackPoint } from './types';

export type TrackInput = {
  activity: ActivityType;
  startedAt: number;
  /** When the workout ended, or "now" while it is still being recorded. */
  endAt: number;
  points: TrackPoint[];
  pauses: PauseInterval[];
};

export type PathPoint = TrackPoint & {
  /** Distance covered from the start up to this point, in metres. */
  distanceM: number;
  /** Recording time (pauses excluded) from the start up to this point, in ms. */
  activeMs: number;
};

export type DropCounts = {
  /** Before the start or after the end. */
  outsideWorkout: number;
  paused: number;
  inaccurate: number;
  outOfOrder: number;
  tooFast: number;
};

/** Numbers for checking the pipeline itself (shown on the dev diagnostics screen). */
export type TrackDiagnostics = {
  pointCount: number;
  keptCount: number;
  dropped: DropCounts;
  /** Every point joined up, noise included. */
  rawDistanceM: number;
  /** Filtered points, before smoothing. */
  unsmoothedDistanceM: number;
  /** Longest time between two fixes: big gaps mean the phone suspended the app. */
  longestGapMs: number;
  averageAccuracyM: number | null;
  mockedCount: number;
};

export type WorkoutTrack = {
  distanceM: number;
  movingMs: number;
  elapsedMs: number;
  averagePaceSecPerKm: number | null;
  /** The cleaned-up route, cut into pieces wherever the workout was paused. */
  segments: PathPoint[][];
  diagnostics: TrackDiagnostics;
};

/**
 * The GPS pipeline: filter → split at pauses → smooth → measure.
 * It is a pure function of the raw points, so the live screen, the summary and
 * the unit tests all get exactly the same numbers from the same input.
 */
export function analyzeTrack({
  activity,
  startedAt,
  endAt,
  points,
  pauses,
}: TrackInput): WorkoutTrack {
  const maxSpeedMps = MAX_SPEED_MPS[activity];
  const dropped: DropCounts = {
    outsideWorkout: 0,
    paused: 0,
    inaccurate: 0,
    outOfOrder: 0,
    tooFast: 0,
  };
  const filtered: TrackPoint[][] = [];
  let currentSegment: TrackPoint[] = [];
  let lastKept: TrackPoint | null = null;

  let rawDistanceM = 0;
  let longestGapMs = 0;
  let accuracySum = 0;
  let accuracyCount = 0;
  let mockedCount = 0;
  let previous: TrackPoint | null = null;

  for (const point of points) {
    if (point.mocked) mockedCount += 1;
    if (point.accuracy !== null) {
      accuracySum += point.accuracy;
      accuracyCount += 1;
    }
    if (previous) {
      rawDistanceM += haversineMeters(previous, point);
      longestGapMs = Math.max(longestGapMs, point.t - previous.t);
    }
    previous = point;

    // 1. Filter.
    if (point.t < startedAt || point.t > endAt) {
      dropped.outsideWorkout += 1;
      continue;
    }
    if (isPausedAt(point.t, pauses)) {
      dropped.paused += 1;
      continue;
    }
    if (point.accuracy === null || point.accuracy > GPS_SETTINGS.maxAccuracyM) {
      dropped.inaccurate += 1;
      continue;
    }
    if (lastKept && point.t <= lastKept.t) {
      dropped.outOfOrder += 1;
      continue;
    }

    // 2. A pause since the last kept point starts a new segment: whatever
    //    distance was covered while paused doesn't count.
    const startsSegment = !lastKept || pausedMsBetween(lastKept.t, point.t, pauses) > 0;
    if (!startsSegment && lastKept) {
      const seconds = (point.t - lastKept.t) / 1000;
      if (haversineMeters(lastKept, point) / seconds > maxSpeedMps) {
        dropped.tooFast += 1; // a jump nobody on foot could make
        continue;
      }
    }
    if (startsSegment) {
      currentSegment = [];
      filtered.push(currentSegment);
    }
    currentSegment.push(point);
    lastKept = point;
  }

  // 3. Smooth each segment, then 4. measure distance and time along it.
  let distanceM = 0;
  let unsmoothedDistanceM = 0;
  const segments = filtered.map((segment) => {
    for (let i = 1; i < segment.length; i += 1) {
      unsmoothedDistanceM += haversineMeters(segment[i - 1], segment[i]);
    }
    const smoothed = smooth(segment, GPS_SETTINGS.smoothingWindow);
    return smoothed.map((point, i): PathPoint => {
      if (i > 0) {
        distanceM += haversineMeters(smoothed[i - 1], point);
      }
      return { ...point, distanceM, activeMs: activeMsAt(point.t, startedAt, pauses) };
    });
  });

  const movingMs = activeMsAt(endAt, startedAt, pauses);

  return {
    distanceM,
    movingMs,
    elapsedMs: Math.max(0, endAt - startedAt),
    averagePaceSecPerKm: paceSecondsPerKm(distanceM, movingMs),
    segments,
    diagnostics: {
      pointCount: points.length,
      keptCount: filtered.reduce((sum, segment) => sum + segment.length, 0),
      dropped,
      rawDistanceM,
      unsmoothedDistanceM,
      longestGapMs,
      averageAccuracyM: accuracyCount > 0 ? accuracySum / accuracyCount : null,
      mockedCount,
    },
  };
}

/**
 * Centred moving average: each point becomes the average of itself and its
 * neighbours. This irons out GPS zig-zag, which would otherwise add distance.
 * The window shrinks near the ends so the first and last points stay put.
 */
export function smooth(segment: TrackPoint[], window: number): TrackPoint[] {
  const half = Math.floor(window / 2);
  if (half < 1) {
    return segment;
  }
  return segment.map((point, i) => {
    const reach = Math.min(half, i, segment.length - 1 - i);
    if (reach === 0) {
      return point;
    }
    let lat = 0;
    let lng = 0;
    for (let j = i - reach; j <= i + reach; j += 1) {
      lat += segment[j].lat;
      lng += segment[j].lng;
    }
    const count = reach * 2 + 1;
    return { ...point, lat: lat / count, lng: lng / count };
  });
}

/** Pace over the last few seconds since the latest pause, or null if there's too little data. */
export function currentPaceSecPerKm(track: WorkoutTrack): number | null {
  const segment = track.segments[track.segments.length - 1];
  if (!segment || segment.length < 2) {
    return null;
  }
  const last = segment[segment.length - 1];
  const windowStartMs = last.activeMs - GPS_SETTINGS.currentPaceWindowMs;
  const first = segment.find((point) => point.activeMs >= windowStartMs) ?? segment[0];
  return paceSecondsPerKm(last.distanceM - first.distanceM, last.activeMs - first.activeMs);
}

/** The newest kept point, e.g. for the "you are here" dot. */
export function lastPathPoint(track: WorkoutTrack): PathPoint | undefined {
  const segment = track.segments[track.segments.length - 1];
  return segment?.[segment.length - 1];
}

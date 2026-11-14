import type { GpsActivityType } from '@/db/schema';

import { GPS_SETTINGS, MAX_SPEED_MPS, STOP_SPEED_MPS } from './config';
import { haversineMeters, paceSecondsPerKm } from './geo';
import { activeMsAt, isPausedAt, pausedMsBetween } from './pauses';
import type { PauseInterval, TrackPoint } from './types';

export type TrackInput = {
  activity: GpsActivityType;
  startedAt: number;
  /** When the workout ended, or "now" while it is still being recorded. */
  endAt: number;
  points: TrackPoint[];
  pauses: PauseInterval[];
  /** Leave out the time and distance while you're standing still. Off when left out. */
  autoPause?: boolean;
};

export type PathPoint = TrackPoint & {
  /** Distance covered from the start up to this point, in metres. */
  distanceM: number;
  /** Moving time (pauses and auto-paused stops excluded) from the start up to this point, in ms. */
  movingMs: number;
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
  /** Time left out by auto-pause. */
  autoPausedMs: number;
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
  /** Auto-pause has stopped the clock right now (the latest fixes are a stop). */
  endsStopped: boolean;
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
  autoPause = false,
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

  // 3. Smooth each segment, then 4. measure distance and time along it,
  //    leaving out stops when auto-pause is on.
  let distanceM = 0;
  let unsmoothedDistanceM = 0;
  let autoPausedMs = 0;
  let endsStopped = false;
  const segments = filtered.map((segment, segmentIndex) => {
    for (let i = 1; i < segment.length; i += 1) {
      unsmoothedDistanceM += haversineMeters(segment[i - 1], segment[i]);
    }
    const smoothed = smooth(segment, GPS_SETTINGS.smoothingWindow);
    const stopped = autoPause
      ? findStops(smoothed, STOP_SPEED_MPS[activity])
      : smoothed.map(() => false);
    if (segmentIndex === filtered.length - 1) {
      endsStopped = stopped[stopped.length - 1] ?? false;
    }
    return smoothed.map((point, i): PathPoint => {
      if (i > 0) {
        if (stopped[i]) {
          autoPausedMs += point.t - smoothed[i - 1].t;
        } else {
          distanceM += haversineMeters(smoothed[i - 1], point);
        }
      }
      return {
        ...point,
        distanceM,
        movingMs: activeMsAt(point.t, startedAt, pauses) - autoPausedMs,
      };
    });
  });

  // Still stopped at the end: the time since the last fix is part of the stop too.
  const lastSegment = filtered[filtered.length - 1];
  const lastPoint = lastSegment?.[lastSegment.length - 1];
  if (endsStopped && lastPoint) {
    autoPausedMs +=
      activeMsAt(endAt, startedAt, pauses) - activeMsAt(lastPoint.t, startedAt, pauses);
  }

  const movingMs = Math.max(0, activeMsAt(endAt, startedAt, pauses) - autoPausedMs);

  return {
    distanceM,
    movingMs,
    elapsedMs: Math.max(0, endAt - startedAt),
    averagePaceSecPerKm: paceSecondsPerKm(distanceM, movingMs),
    segments,
    endsStopped,
    diagnostics: {
      pointCount: points.length,
      keptCount: filtered.reduce((sum, segment) => sum + segment.length, 0),
      dropped,
      rawDistanceM,
      unsmoothedDistanceM,
      longestGapMs,
      autoPausedMs,
      averageAccuracyM: accuracyCount > 0 ? accuracySum / accuracyCount : null,
      mockedCount,
    },
  };
}

/**
 * Auto-pause: marks each step (from point i - 1 to point i) that belongs to a stop.
 *
 * Speed is measured as the straight-line distance between the points about two
 * seconds either side, divided by the time between them. Standing still, GPS
 * wobbles back and forth, and those wobbles cancel out over the window; walking
 * or running, the distance adds up. Steps slower than `stopSpeedMps` for at
 * least `minStopMs` in a row count as a stop.
 */
export function findStops(
  points: TrackPoint[],
  stopSpeedMps: number,
  minStopMs: number = GPS_SETTINGS.autoPauseAfterMs,
  windowMs: number = GPS_SETTINGS.stopWindowMs,
): boolean[] {
  const slow = points.map(() => false);
  let from = 0;
  let to = 0;
  for (let i = 1; i < points.length; i += 1) {
    while (points[i].t - points[from].t > windowMs && from < i - 1) from += 1;
    to = Math.max(to, i);
    while (to + 1 < points.length && points[to + 1].t - points[i].t <= windowMs) to += 1;
    const seconds = (points[to].t - points[from].t) / 1000;
    const speed = seconds > 0 ? haversineMeters(points[from], points[to]) / seconds : 0;
    slow[i] = speed < stopSpeedMps;
  }

  // Keep only runs of slow steps that last long enough to be a real stop.
  const stopped = points.map(() => false);
  let runStart = -1;
  const closeRun = (end: number) => {
    if (runStart > 0 && points[end - 1].t - points[runStart - 1].t >= minStopMs) {
      for (let k = runStart; k < end; k += 1) stopped[k] = true;
    }
    runStart = -1;
  };
  for (let i = 1; i < points.length; i += 1) {
    if (slow[i]) {
      if (runStart < 0) runStart = i;
    } else {
      closeRun(i);
    }
  }
  closeRun(points.length);
  return stopped;
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
  if (!segment || segment.length < 2 || track.endsStopped) {
    return null;
  }
  const last = segment[segment.length - 1];
  const windowStartMs = last.movingMs - GPS_SETTINGS.currentPaceWindowMs;
  const first = segment.find((point) => point.movingMs >= windowStartMs) ?? segment[0];
  return paceSecondsPerKm(last.distanceM - first.distanceM, last.movingMs - first.movingMs);
}

/** The newest kept point, e.g. for the "you are here" dot. */
export function lastPathPoint(track: WorkoutTrack): PathPoint | undefined {
  const segment = track.segments[track.segments.length - 1];
  return segment?.[segment.length - 1];
}

import type { GpsActivityType } from '@/db/schema';

// Every GPS threshold lives here, so tuning them after real runs means editing
// one file. Raw points are always kept, so old workouts can be recalculated.

export const GPS_SETTINGS = {
  /** Before starting, a fix at least this accurate counts as ready. */
  goodFixAccuracyM: 20,
  /** A fix at least this accurate is shown as a strong signal. */
  strongFixAccuracyM: 10,
  /** Points with a worse accuracy radius than this are dropped. */
  maxAccuracyM: 25,
  /** Moving-average window, in points (odd number; 1 turns smoothing off). */
  smoothingWindow: 3,
  /** Current pace looks back over this much recording time. */
  currentPaceWindowMs: 20_000,
  /** Pace stays blank until at least this much distance is covered. */
  minPaceDistanceM: 10,
  /** No new fix for this long means the signal is lost. */
  signalLostAfterMs: 10_000,
  /** Elevation: altitude moving-average window (points) and the smallest climb that counts. */
  elevationSmoothingWindow: 5,
  elevationThresholdM: 3,
  /** A last split shorter than this isn't shown. */
  minPartialSplitM: 10,
  /** Auto-pause: you count as stopped after moving slower than the limit for this long. */
  autoPauseAfterMs: 5_000,
  /**
   * Auto-pause measures speed as the straight-line distance between the points
   * this far either side of each fix, so GPS wobble while standing still cancels out.
   */
  stopWindowMs: 2_000,
};

/** Auto-pause: slower than this counts as standing still. */
export const STOP_SPEED_MPS: Record<GpsActivityType, number> = {
  run: 1.0, // 3.6 km/h: slower than any running pace
  walk: 0.6, // 2.2 km/h: slower than a slow stroll
  cycle: 1.5, // 5.4 km/h: about as slow as a bike stays upright
  hike: 0.4, // steep climbs are slow, so stop only when really still
  wheelchair: 0.5,
};

/** Speeds faster than this are GPS jumps, not real movement. */
export const MAX_SPEED_MPS: Record<GpsActivityType, number> = {
  run: 10, // 36 km/h; even sprinters only touch 12 m/s for a moment
  walk: 6, // 21.6 km/h; leaves room for a short jog
  cycle: 25, // 90 km/h; fast descents
  hike: 5, // 18 km/h; leaves room for a run downhill
  wheelchair: 12, // 43 km/h; racing chairs downhill
};

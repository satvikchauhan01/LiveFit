import type { ActivityType } from '@/db/schema';

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
  /** A last split shorter than this isn't shown. */
  minPartialSplitM: 10,
};

/** Speeds faster than this are GPS jumps, not real movement. */
export const MAX_SPEED_MPS: Record<ActivityType, number> = {
  run: 10, // 36 km/h; even sprinters only touch 12 m/s for a moment
  walk: 6, // 21.6 km/h; leaves room for a short jog
};

import { create } from 'zustand';

import {
  GPS_ACTIVITY_TYPES,
  type GpsActivityType,
  isGpsActivityType,
  type Workout,
  type WorkoutLap,
  type WorkoutPause,
} from '@/db/schema';
import { track as trackEvent } from '@/features/analytics/analytics';
import { useProfileStore } from '@/features/profile/profileStore';
import { openPause } from '@/features/tracking/pauses';
import { bestEfforts } from '@/features/tracking/bestEfforts';
import { analyzeTrack, type WorkoutTrack } from '@/features/tracking/pipeline';
import { computeLaps, computeSplits } from '@/features/tracking/splits';
import { endLiveShare, setLiveDistance, useLiveShareStore } from '@/features/live/liveShare';
import { subscribeToNewPoints } from '@/features/tracking/trackingEvents';
import type { TrackPoint } from '@/features/tracking/types';
import {
  createWorkout,
  deletePause,
  endPause,
  finishWorkout,
  getActiveWorkout,
  getLaps,
  getPauses,
  getTrackPoints,
  insertLap,
  removeWorkoutPermanently,
  startPause,
} from '@/features/workouts/workoutRepository';
import { defaultWorkoutTitle } from '@/features/workouts/workoutTitle';
import { estimateCalories } from '@/lib/calories';
import { metersPerUnit } from '@/lib/units';

import { lapAnnouncement, splitAnnouncement } from './announcements';
import {
  type ActionResult,
  ensureLocationReady,
  isLocationTaskRunning,
  readBatteryLevel,
  startLocationUpdates,
  stopLocationUpdates,
} from './locationUpdates';
import { speak } from './voice';

export type { ActionResult };

/**
 * The recorder is a small state machine:
 *
 *   idle ──start──▶ live (recording ⇄ paused) ──finish──▶ idle (workout saved)
 *                     └────────────discard─────────────▶ idle (workout deleted)
 *
 * The database is the source of truth; this store mirrors the active workout
 * so the live screen can redraw without querying SQLite every second.
 */
export type RecorderPhase = 'idle' | 'live';

/** A workout row known to be a run or walk. */
export type GpsWorkout = Workout & { type: GpsActivityType };

function isGpsWorkout(workout: Workout): workout is GpsWorkout {
  return isGpsActivityType(workout.type);
}

/** No new GPS fix for this long at launch means the app was closed mid-workout. */
const RECOVERY_GAP_MS = 60_000;

/** How often new points are checked for a finished km/mile to announce. */
const VOICE_CHECK_INTERVAL_MS = 5_000;

/** The pipeline run over the live workout's points so far. */
export function analyzeLive(
  workout: GpsWorkout,
  points: TrackPoint[],
  pauses: WorkoutPause[],
  now: number,
): WorkoutTrack {
  const lastFix = points[points.length - 1]?.t ?? 0;
  return analyzeTrack({
    activity: workout.type,
    startedAt: workout.startedAt,
    // The GPS clock can run slightly ahead of the phone's clock; never drop the newest fix.
    endAt: Math.max(now, lastFix),
    points,
    pauses,
    autoPause: workout.autoPause,
  });
}

function distanceUnit() {
  return useProfileStore.getState().profile?.distanceUnit ?? 'km';
}

function voiceCuesOn() {
  return useProfileStore.getState().profile?.voiceCues ?? false;
}

type RecorderState = {
  /** False until the launch-time check for an unfinished workout has run. */
  restored: boolean;
  phase: RecorderPhase;
  workout: GpsWorkout | null;
  points: TrackPoint[];
  pauses: WorkoutPause[];
  laps: WorkoutLap[];
  /** Completed km/mile splits already announced by voice. */
  announcedSplits: number;
  /** The app was closed while recording; the gap is treated as a pause. */
  interrupted: boolean;
  /** An unfinished workout was found at launch, so the live screen should open. */
  reopenPending: boolean;

  restore: () => Promise<void>;
  start: (activity: GpsActivityType) => Promise<ActionResult>;
  pause: () => Promise<void>;
  resume: () => Promise<ActionResult>;
  /** Ends the current lap and starts the next one. */
  lap: () => Promise<void>;
  /** Announces a newly completed km/mile, if voice cues are on. */
  checkVoiceCues: () => void;
  /** Stops recording and saves the summary. Returns the saved workout. */
  finish: () => Promise<Workout | null>;
  discard: () => Promise<void>;
  acknowledgeReopen: () => void;
};

const IDLE = {
  phase: 'idle',
  workout: null,
  points: [],
  pauses: [],
  laps: [],
  announcedSplits: 0,
  interrupted: false,
  reopenPending: false,
} satisfies Partial<RecorderState>;

let lastVoiceCheck = 0;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export const useRecorderStore = create<RecorderState>()((set, get) => ({
  restored: false,
  ...IDLE,

  restore: async () => {
    const found = await getActiveWorkout(GPS_ACTIVITY_TYPES);
    const workout = found && isGpsWorkout(found) ? found : null;
    const running = await isLocationTaskRunning();

    if (!workout) {
      if (running) {
        await stopLocationUpdates(); // nothing to record into
      }
      set({ ...IDLE, restored: true });
      return;
    }

    const [points, pauses, laps] = await Promise.all([
      getTrackPoints(workout.id),
      getPauses(workout.id),
      getLaps(workout.id),
    ]);
    const lastFixAt = points.length > 0 ? points[points.length - 1].t : workout.startedAt;
    const stale = Date.now() - lastFixAt > RECOVERY_GAP_MS;
    const interrupted = !running || (stale && !openPause(pauses));

    if (interrupted && !openPause(pauses)) {
      // GPS stopped without a pause: the app was killed or the phone restarted.
      // Pausing from the last fix means the gap counts as neither time nor distance.
      pauses.push(await startPause(workout.id, lastFixAt));
    }

    // Don't re-announce kilometres that were already called out before the restart.
    const track = analyzeLive(workout, points, pauses, Date.now());
    const announcedSplits = computeSplits(track, metersPerUnit(distanceUnit())).completed.length;

    set({
      restored: true,
      phase: 'live',
      workout,
      points,
      pauses,
      laps,
      announcedSplits,
      interrupted,
      reopenPending: true,
    });
  },

  start: async (activity) => {
    if (get().phase === 'live') {
      return { ok: true };
    }
    if (await getActiveWorkout(['strength'])) {
      return { ok: false, reason: 'Finish your strength workout before starting a run or walk.' };
    }
    const ready = await ensureLocationReady();
    if (!ready.ok) {
      return ready;
    }

    const batteryStart = await readBatteryLevel();
    const created = await createWorkout({
      type: activity,
      source: 'gps',
      startedAt: Date.now(),
      batteryStart,
      autoPause: useProfileStore.getState().profile?.autoPause ?? true,
    });
    const workout: GpsWorkout = { ...created, type: activity };
    set({ ...IDLE, phase: 'live', workout });

    try {
      await startLocationUpdates(activity);
    } catch (error) {
      await removeWorkoutPermanently(workout.id);
      set(IDLE);
      return { ok: false, reason: `GPS recording couldn’t start: ${errorMessage(error)}` };
    }
    return { ok: true };
  },

  pause: async () => {
    const { workout, pauses } = get();
    if (!workout || openPause(pauses)) {
      return;
    }
    // GPS keeps running while paused: the notification keeps the app alive and
    // the signal stays warm for resuming. Points inside a pause are ignored.
    const pause = await startPause(workout.id, Date.now());
    set({ pauses: [...get().pauses, pause] });
  },

  resume: async () => {
    const { workout } = get();
    if (!workout) {
      return { ok: true };
    }

    if (!(await isLocationTaskRunning())) {
      // After an interruption GPS has to be started again.
      const ready = await ensureLocationReady();
      if (!ready.ok) {
        return ready;
      }
      try {
        await startLocationUpdates(workout.type);
      } catch (error) {
        return { ok: false, reason: `GPS recording couldn’t restart: ${errorMessage(error)}` };
      }
    }

    const pause = openPause(get().pauses);
    if (pause) {
      const endedAt = Date.now();
      await endPause(pause.id, endedAt);
      set({ pauses: get().pauses.map((p) => (p.id === pause.id ? { ...p, endedAt } : p)) });
    }
    set({ interrupted: false });
    return { ok: true };
  },

  lap: async () => {
    const { workout, pauses } = get();
    if (!workout || openPause(pauses)) {
      return;
    }
    const lap = await insertLap(workout.id, Date.now());
    const laps = [...get().laps, lap];
    set({ laps });

    if (voiceCuesOn()) {
      const track = analyzeLive(workout, get().points, get().pauses, Date.now());
      const finishedLap = computeLaps(
        track,
        laps.map((item) => item.t),
      )[laps.length - 1];
      if (finishedLap) speak(lapAnnouncement(finishedLap, distanceUnit()));
    }
  },

  checkVoiceCues: () => {
    const { phase, workout, points, pauses, announcedSplits } = get();
    const now = Date.now();
    if (phase !== 'live' || !workout || now - lastVoiceCheck < VOICE_CHECK_INTERVAL_MS) {
      return;
    }
    lastVoiceCheck = now;

    const unit = distanceUnit();
    const track = analyzeLive(workout, points, pauses, now);
    const { completed } = computeSplits(track, metersPerUnit(unit));
    if (completed.length <= announcedSplits) {
      return;
    }
    set({ announcedSplits: completed.length });
    if (voiceCuesOn()) {
      speak(splitAnnouncement(completed[completed.length - 1], unit, track.movingMs));
    }
  },

  finish: async () => {
    const { workout, pauses } = get();
    if (!workout) {
      return null;
    }
    await stopLocationUpdates();

    // Finishing while paused ends the workout when the pause began,
    // so a trailing pause doesn't inflate the elapsed time.
    const trailingPause = openPause(pauses);
    const endedAt = trailingPause ? trailingPause.startedAt : Date.now();
    if (trailingPause) {
      await deletePause(trailingPause.id);
    }
    const keptPauses = pauses.filter((pause) => pause !== trailingPause);

    // Read the points back from the database: it has every point, even any
    // that arrived while the UI wasn't listening.
    const points = await getTrackPoints(workout.id);
    const track = analyzeTrack({
      activity: workout.type,
      startedAt: workout.startedAt,
      endAt: endedAt,
      points,
      pauses: keptPauses,
      autoPause: workout.autoPause,
    });

    const finished = await finishWorkout(workout.id, {
      endedAt,
      elapsedS: Math.round(track.elapsedMs / 1000),
      movingS: Math.round(track.movingMs / 1000),
      distanceM: track.distanceM,
      volumeKg: null,
      elevationGainM: Math.round(track.elevationGainM),
      caloriesEst: estimateCalories({
        activity: workout.type,
        movingS: track.movingMs / 1000,
        distanceM: track.distanceM,
        weightKg: useProfileStore.getState().profile?.weightKg ?? null,
      }),
      extras: JSON.stringify({ bestEfforts: bestEfforts(track) }),
      title: defaultWorkoutTitle(workout.type, workout.startedAt),
      batteryEnd: await readBatteryLevel(),
    });
    set(IDLE);
    endLiveShare().catch(() => {});
    trackEvent('workout_finished', { type: workout.type, source: 'gps' });
    return finished;
  },

  discard: async () => {
    const { workout } = get();
    await stopLocationUpdates();
    if (workout) {
      await removeWorkoutPermanently(workout.id);
    }
    set(IDLE);
    endLiveShare().catch(() => {});
  },

  acknowledgeReopen: () => set({ reopenPending: false }),
}));

// New GPS points go straight into the store while a workout is live.
let lastLiveDistanceAt = 0;

subscribeToNewPoints((workoutId, newPoints) => {
  const { phase, workout, points, pauses, checkVoiceCues } = useRecorderStore.getState();
  if (phase === 'live' && workout?.id === workoutId) {
    const allPoints = [...points, ...newPoints];
    useRecorderStore.setState({ points: allPoints });
    // This runs with the screen off too, so the voice keeps you posted.
    checkVoiceCues();
    // Friends following a live link see the distance so far.
    const now = Date.now();
    if (useLiveShareStore.getState().share && now - lastLiveDistanceAt > 15_000) {
      lastLiveDistanceAt = now;
      setLiveDistance(analyzeLive(workout, allPoints, pauses, now).distanceM);
    }
  }
});

export function useIsPaused(): boolean {
  return useRecorderStore((state) => openPause(state.pauses) !== undefined);
}

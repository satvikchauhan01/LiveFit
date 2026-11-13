import { create } from 'zustand';

import type { ActivityType, Workout, WorkoutPause } from '@/db/schema';
import { openPause } from '@/features/tracking/pauses';
import { analyzeTrack } from '@/features/tracking/pipeline';
import { subscribeToNewPoints } from '@/features/tracking/trackingEvents';
import type { TrackPoint } from '@/features/tracking/types';
import {
  createWorkout,
  deletePause,
  deleteWorkout,
  endPause,
  finishWorkout,
  getActiveWorkout,
  getPauses,
  getTrackPoints,
  startPause,
} from '@/features/workouts/workoutRepository';
import { defaultWorkoutTitle } from '@/features/workouts/workoutTitle';

import {
  type ActionResult,
  ensureLocationReady,
  isLocationTaskRunning,
  readBatteryLevel,
  startLocationUpdates,
  stopLocationUpdates,
} from './locationUpdates';

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

/** No new GPS fix for this long at launch means the app was closed mid-workout. */
const RECOVERY_GAP_MS = 60_000;

type RecorderState = {
  /** False until the launch-time check for an unfinished workout has run. */
  restored: boolean;
  phase: RecorderPhase;
  workout: Workout | null;
  points: TrackPoint[];
  pauses: WorkoutPause[];
  /** The app was closed while recording; the gap is treated as a pause. */
  interrupted: boolean;
  /** An unfinished workout was found at launch, so the live screen should open. */
  reopenPending: boolean;

  restore: () => Promise<void>;
  start: (activity: ActivityType) => Promise<ActionResult>;
  pause: () => Promise<void>;
  resume: () => Promise<ActionResult>;
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
  interrupted: false,
  reopenPending: false,
} satisfies Partial<RecorderState>;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export const useRecorderStore = create<RecorderState>()((set, get) => ({
  restored: false,
  ...IDLE,

  restore: async () => {
    const workout = await getActiveWorkout();
    const running = await isLocationTaskRunning();

    if (!workout) {
      if (running) {
        await stopLocationUpdates(); // nothing to record into
      }
      set({ ...IDLE, restored: true });
      return;
    }

    const [points, pauses] = await Promise.all([getTrackPoints(workout.id), getPauses(workout.id)]);
    const lastFixAt = points.length > 0 ? points[points.length - 1].t : workout.startedAt;
    const stale = Date.now() - lastFixAt > RECOVERY_GAP_MS;
    const interrupted = !running || (stale && !openPause(pauses));

    if (interrupted && !openPause(pauses)) {
      // GPS stopped without a pause: the app was killed or the phone restarted.
      // Pausing from the last fix means the gap counts as neither time nor distance.
      pauses.push(await startPause(workout.id, lastFixAt));
    }

    set({
      restored: true,
      phase: 'live',
      workout,
      points,
      pauses,
      interrupted,
      reopenPending: true,
    });
  },

  start: async (activity) => {
    if (get().phase === 'live') {
      return { ok: true };
    }
    const ready = await ensureLocationReady();
    if (!ready.ok) {
      return ready;
    }

    const batteryStart = await readBatteryLevel();
    const workout = await createWorkout({ type: activity, startedAt: Date.now(), batteryStart });
    set({ ...IDLE, phase: 'live', workout });

    try {
      await startLocationUpdates(activity);
    } catch (error) {
      await deleteWorkout(workout.id);
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
    });

    const finished = await finishWorkout(workout.id, {
      endedAt,
      elapsedS: Math.round(track.elapsedMs / 1000),
      movingS: Math.round(track.movingMs / 1000),
      distanceM: track.distanceM,
      title: defaultWorkoutTitle(workout.type, workout.startedAt),
      batteryEnd: await readBatteryLevel(),
    });
    set(IDLE);
    return finished;
  },

  discard: async () => {
    const { workout } = get();
    await stopLocationUpdates();
    if (workout) {
      await deleteWorkout(workout.id);
    }
    set(IDLE);
  },

  acknowledgeReopen: () => set({ reopenPending: false }),
}));

// New GPS points go straight into the store while a workout is live.
subscribeToNewPoints((workoutId, newPoints) => {
  const { phase, workout, points } = useRecorderStore.getState();
  if (phase === 'live' && workout?.id === workoutId) {
    useRecorderStore.setState({ points: [...points, ...newPoints] });
  }
});

export function useIsPaused(): boolean {
  return useRecorderStore((state) => openPause(state.pauses) !== undefined);
}

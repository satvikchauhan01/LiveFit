import { create } from 'zustand';

import { type Exercise, GPS_ACTIVITY_TYPES, type StrengthSet, type Workout } from '@/db/schema';
import { useProfileStore } from '@/features/profile/profileStore';
import {
  createWorkout,
  deleteWorkout,
  finishWorkout,
  getActiveWorkout,
} from '@/features/workouts/workoutRepository';
import { defaultWorkoutTitle } from '@/features/workouts/workoutTitle';

import { cancelRestAlert, scheduleRestAlert } from './restAlerts';
import { sessionTotals } from './strengthMath';
import {
  deleteExerciseSets,
  deleteIncompleteSets,
  deleteSet,
  type ExerciseLog,
  getExerciseLogs,
  getLastSets,
  insertSets,
  type SetValues,
  updateSet,
} from './strengthRepository';

/** One exercise in the session, plus what was done last time (for the hint). */
export type SessionExercise = ExerciseLog & { lastTime: StrengthSet[] };

export type RestTimer = {
  endsAt: number;
  /** Id of the scheduled "Rest over" notification, to cancel it if plans change. */
  notificationId: string | null;
};

export type StartResult = { ok: true } | { ok: false; reason: string };

const DEFAULT_REST_SECONDS = 90;

type StrengthState = {
  restored: boolean;
  /** The strength workout in progress, or null. */
  workout: Workout | null;
  exercises: SessionExercise[];
  rest: RestTimer | null;
  reopenPending: boolean;

  restore: () => Promise<void>;
  start: () => Promise<StartResult>;
  addExercise: (exercise: Exercise) => Promise<void>;
  removeExercise: (order: number) => Promise<void>;
  addSet: (order: number) => Promise<void>;
  /** Saves edited values without ticking the set off. */
  saveSet: (setId: number, values: SetValues) => Promise<void>;
  /** Ticks a set off with these values and starts the rest timer. */
  completeSet: (setId: number, values: SetValues) => Promise<void>;
  reopenSet: (setId: number) => Promise<void>;
  deleteSet: (setId: number) => Promise<void>;
  adjustRest: (seconds: number) => Promise<void>;
  skipRest: () => Promise<void>;
  finish: () => Promise<Workout | null>;
  discard: () => Promise<void>;
  acknowledgeReopen: () => void;
};

const IDLE = {
  workout: null,
  exercises: [],
  rest: null,
  reopenPending: false,
} satisfies Partial<StrengthState>;

/** Returns `exercises` with one set swapped for `updated`. */
function replaceSet(exercises: SessionExercise[], updated: StrengthSet): SessionExercise[] {
  return exercises.map((entry) =>
    entry.order === updated.exerciseOrder
      ? { ...entry, sets: entry.sets.map((set) => (set.id === updated.id ? updated : set)) }
      : entry,
  );
}

const emptyValues: SetValues = { reps: null, weightKg: null, durationS: null };

const valuesOf = ({ reps, weightKg, durationS }: SetValues): SetValues => ({
  reps,
  weightKg,
  durationS,
});

export const useStrengthStore = create<StrengthState>()((set, get) => {
  /** Starts (or restarts) the rest timer and schedules its notification. */
  const startRest = async (seconds: number) => {
    await cancelRestAlert(get().rest?.notificationId);
    const endsAt = Date.now() + seconds * 1000;
    // Show the timer straight away; scheduling the alert can take a moment.
    set({ rest: { endsAt, notificationId: null } });
    const notificationId = await scheduleRestAlert(endsAt).catch(() => null);
    if (get().rest?.endsAt === endsAt) {
      set({ rest: { endsAt, notificationId } });
    } else {
      await cancelRestAlert(notificationId); // the timer changed in the meantime
    }
  };

  return {
    restored: false,
    ...IDLE,

    restore: async () => {
      const workout = await getActiveWorkout(['strength']);
      if (!workout) {
        set({ ...IDLE, restored: true });
        return;
      }
      const logs = await getExerciseLogs(workout.id);
      const exercises = await Promise.all(
        logs.map(async (log) => ({
          ...log,
          lastTime: await getLastSets(log.exercise.id, workout.id),
        })),
      );
      set({ ...IDLE, restored: true, workout, exercises, reopenPending: true });
    },

    start: async () => {
      if (get().workout) {
        return { ok: true };
      }
      if (await getActiveWorkout(GPS_ACTIVITY_TYPES)) {
        return { ok: false, reason: 'Finish your run or walk before starting a strength workout.' };
      }
      const workout = await createWorkout({
        type: 'strength',
        source: 'manual',
        startedAt: Date.now(),
        batteryStart: null,
      });
      set({ ...IDLE, workout });
      return { ok: true };
    },

    addExercise: async (exercise) => {
      const { workout, exercises } = get();
      if (!workout) return;
      const order = exercises.reduce((max, entry) => Math.max(max, entry.order), 0) + 1;
      const lastTime = await getLastSets(exercise.id, workout.id);

      // Start with last session's sets and values, so repeating it is one tap per set.
      const templates = lastTime.length > 0 ? lastTime.map(valuesOf) : [emptyValues];
      const sets = await insertSets(
        templates.map((values, setIndex) => ({
          ...values,
          workoutId: workout.id,
          exerciseId: exercise.id,
          exerciseOrder: order,
          setIndex,
        })),
      );
      set({ exercises: [...get().exercises, { order, exercise, sets, lastTime }] });
    },

    removeExercise: async (order) => {
      const { workout } = get();
      if (!workout) return;
      await deleteExerciseSets(workout.id, order);
      set({ exercises: get().exercises.filter((entry) => entry.order !== order) });
    },

    addSet: async (order) => {
      const { workout, exercises } = get();
      const entry = exercises.find((item) => item.order === order);
      if (!workout || !entry) return;
      // A new set copies the one before it: the "repeat previous set" shortcut.
      const previous = entry.sets[entry.sets.length - 1];
      const [created] = await insertSets([
        {
          ...(previous ? valuesOf(previous) : emptyValues),
          workoutId: workout.id,
          exerciseId: entry.exercise.id,
          exerciseOrder: order,
          setIndex: (previous?.setIndex ?? -1) + 1,
        },
      ]);
      set({
        exercises: get().exercises.map((item) =>
          item.order === order ? { ...item, sets: [...item.sets, created] } : item,
        ),
      });
    },

    saveSet: async (setId, values) => {
      const updated = await updateSet(setId, values);
      set({ exercises: replaceSet(get().exercises, updated) });
    },

    completeSet: async (setId, values) => {
      const updated = await updateSet(setId, { ...values, completedAt: Date.now() });
      set({ exercises: replaceSet(get().exercises, updated) });
      const restSeconds = useProfileStore.getState().profile?.restSeconds ?? DEFAULT_REST_SECONDS;
      await startRest(restSeconds);
    },

    reopenSet: async (setId) => {
      const updated = await updateSet(setId, { completedAt: null });
      set({ exercises: replaceSet(get().exercises, updated) });
    },

    deleteSet: async (setId) => {
      await deleteSet(setId);
      set({
        exercises: get()
          .exercises.map((entry) => ({
            ...entry,
            sets: entry.sets.filter((item) => item.id !== setId),
          }))
          // An exercise with no sets left goes too.
          .filter((entry) => entry.sets.length > 0),
      });
    },

    adjustRest: async (seconds) => {
      const { rest } = get();
      if (!rest) return;
      const remainingS = Math.max(0, (rest.endsAt - Date.now()) / 1000 + seconds);
      await startRest(Math.round(remainingS));
    },

    skipRest: async () => {
      await cancelRestAlert(get().rest?.notificationId);
      set({ rest: null });
    },

    finish: async () => {
      const { workout, rest } = get();
      if (!workout) return null;
      await cancelRestAlert(rest?.notificationId);
      await deleteIncompleteSets(workout.id);

      const totals = sessionTotals(await getExerciseLogs(workout.id));
      const endedAt = Date.now();
      const elapsedS = Math.round((endedAt - workout.startedAt) / 1000);
      const finished = await finishWorkout(workout.id, {
        endedAt,
        elapsedS,
        movingS: elapsedS, // no pauses in a strength session
        distanceM: null,
        volumeKg: totals.volumeKg,
        title: defaultWorkoutTitle('strength', workout.startedAt),
        batteryEnd: null,
      });
      set(IDLE);
      return finished;
    },

    discard: async () => {
      const { workout, rest } = get();
      await cancelRestAlert(rest?.notificationId);
      if (workout) {
        await deleteWorkout(workout.id);
      }
      set(IDLE);
    },

    acknowledgeReopen: () => set({ reopenPending: false }),
  };
});

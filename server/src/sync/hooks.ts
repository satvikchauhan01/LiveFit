import type { Workout } from '../db/schema';

type WorkoutListener = (workout: Workout) => Promise<void>;

const listeners: WorkoutListener[] = [];

/**
 * Lets other features react when a workout is uploaded or edited (e.g. the
 * community features prepare a privacy-trimmed route and update challenge
 * progress), without the sync code having to know about them.
 */
export function onWorkoutSavedListener(listener: WorkoutListener): void {
  listeners.push(listener);
}

export async function onWorkoutSaved(workout: Workout): Promise<void> {
  for (const listener of listeners) {
    try {
      await listener(workout);
    } catch (error) {
      // A failing extra must never make the upload itself fail.
      console.error('[workout hook]', error);
    }
  }
}

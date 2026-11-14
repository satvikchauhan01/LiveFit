import { Alert } from 'react-native';

import type { ExerciseLog } from '@/features/strength/strengthRepository';

import type { RoutineItem } from './plans';
import { createRoutine } from './progressRepository';

/** Turns a finished strength workout into a routine: same exercises, set count, reps and weight. */
export function routineFromWorkout(logs: ExerciseLog[]): RoutineItem[] {
  return logs.map((log) => {
    const last = log.sets[log.sets.length - 1];
    return {
      exerciseId: log.exercise.id,
      sets: log.sets.length,
      reps: last?.reps ?? null,
      weightKg: last?.weightKg ?? null,
      durationS: last?.durationS ?? null,
    };
  });
}

export async function saveAsRoutine(logs: ExerciseLog[], name: string): Promise<void> {
  try {
    await createRoutine(name, routineFromWorkout(logs));
    Alert.alert('Routine saved', `“${name}” is in Progress → Strength routines.`);
  } catch (error) {
    Alert.alert('Couldn’t save the routine', String(error));
  }
}

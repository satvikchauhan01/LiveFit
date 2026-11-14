import { type Exercise, MUSCLE_GROUPS } from '@/db/schema';

import { MUSCLE_GROUP_LABEL } from './builtInExercises';

export type ExerciseSection = { key: string; title: string; data: Exercise[] };

/**
 * Exercises whose name contains every word typed, in any order ("press bench"
 * finds Bench Press, Incline Bench Press and Dumbbell Bench Press), grouped by
 * muscle group in a fixed order and sorted by name inside each group.
 */
export function searchExercises(all: Exercise[], query: string): ExerciseSection[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matches = all.filter((exercise) => {
    const name = exercise.name.toLowerCase();
    return words.every((word) => name.includes(word));
  });

  return MUSCLE_GROUPS.map((group) => ({
    key: group,
    title: MUSCLE_GROUP_LABEL[group],
    data: matches
      .filter((exercise) => exercise.muscleGroup === group)
      .sort((a, b) => a.name.localeCompare(b.name)),
  })).filter((section) => section.data.length > 0);
}

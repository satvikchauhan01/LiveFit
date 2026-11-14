import { useCallback } from 'react';

import { useQueryOnFocus } from '@/lib/useQueryOnFocus';

import {
  getTotals,
  listWorkouts,
  type Totals,
  type WorkoutFilter,
  type WorkoutListItem,
} from './workoutRepository';

/** Finished workouts matching `filter`, newest first. Keep `filter` stable with useMemo. */
export function useWorkoutList(filter: WorkoutFilter, limit?: number): WorkoutListItem[] | null {
  return useQueryOnFocus(useCallback(() => listWorkouts(filter, limit), [filter, limit]));
}

/** Count, distance and time of the workouts matching `filter`. */
export function useWorkoutTotals(filter: WorkoutFilter): Totals | null {
  return useQueryOnFocus(useCallback(() => getTotals(filter), [filter]));
}

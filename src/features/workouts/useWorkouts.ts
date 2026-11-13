import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import type { Workout } from '@/db/schema';

import { getTotalsSince, listFinishedWorkouts, type Totals } from './workoutRepository';

/**
 * Finished workouts, newest first, reloaded each time the screen comes into view
 * (so a workout saved a moment ago shows up when you return to the tab).
 */
export function useFinishedWorkouts(limit?: number): Workout[] | null {
  const [list, setList] = useState<Workout[] | null>(null);
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      listFinishedWorkouts(limit)
        .then((rows) => {
          if (!cancelled) setList(rows);
        })
        .catch((error: unknown) => console.warn('[workouts] load failed', error));
      return () => {
        cancelled = true;
      };
    }, [limit]),
  );
  return list;
}

/** Totals for finished workouts since `fromMs`, reloaded when the screen comes into view. */
export function useTotalsSince(fromMs: number): Totals | null {
  const [totals, setTotals] = useState<Totals | null>(null);
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getTotalsSince(fromMs)
        .then((result) => {
          if (!cancelled) setTotals(result);
        })
        .catch((error: unknown) => console.warn('[workouts] totals failed', error));
      return () => {
        cancelled = true;
      };
    }, [fromMs]),
  );
  return totals;
}

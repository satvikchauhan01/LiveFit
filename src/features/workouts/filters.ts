import type { ActivityType } from '@/db/schema';
import { startOfWeek } from '@/lib/dates';

import type { WorkoutFilter } from './workoutRepository';

export type ActivityFilter = 'all' | ActivityType;
export type DateRange = 'all' | '4w' | '3m' | 'year';

export const ACTIVITY_FILTERS: { value: ActivityFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'run', label: 'Runs' },
  { value: 'walk', label: 'Walks' },
  { value: 'cycle', label: 'Rides' },
  { value: 'hike', label: 'Hikes' },
  { value: 'wheelchair', label: 'Wheelchair' },
  { value: 'strength', label: 'Strength' },
];

export const DATE_RANGES: { value: DateRange; label: string }[] = [
  { value: 'all', label: 'All time' },
  { value: '4w', label: 'Last 4 weeks' },
  { value: '3m', label: 'Last 3 months' },
  { value: 'year', label: 'This year' },
];

/** Where a date range begins, in the phone's local time. */
export function rangeStart(range: DateRange, now: Date = new Date()): number | undefined {
  switch (range) {
    case 'all':
      return undefined;
    case '4w': {
      // This week plus the three before it, so every week shown is complete.
      const start = startOfWeek(now);
      start.setDate(start.getDate() - 21);
      return start.getTime();
    }
    case '3m':
      // This month plus the two before it. Month -1 rolls back into last year.
      return new Date(now.getFullYear(), now.getMonth() - 2, 1).getTime();
    case 'year':
      return new Date(now.getFullYear(), 0, 1).getTime();
  }
}

export function toWorkoutFilter(activity: ActivityFilter, range: DateRange): WorkoutFilter {
  return {
    types: activity === 'all' ? undefined : [activity],
    fromMs: rangeStart(range),
  };
}

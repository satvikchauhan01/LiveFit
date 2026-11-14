import type { ActivityType } from '@/db/schema';

import { ACTIVITY_DISPLAY } from './activities';

/** "Morning run", "Evening walk", "Afternoon workout"… based on the local hour it started. */
export function defaultWorkoutTitle(activity: ActivityType, startedAt: number): string {
  const hour = new Date(startedAt).getHours();
  let partOfDay: string;
  if (hour >= 5 && hour < 12) partOfDay = 'Morning';
  else if (hour >= 12 && hour < 17) partOfDay = 'Afternoon';
  else if (hour >= 17 && hour < 21) partOfDay = 'Evening';
  else partOfDay = 'Night';
  return `${partOfDay} ${ACTIVITY_DISPLAY[activity].word}`;
}

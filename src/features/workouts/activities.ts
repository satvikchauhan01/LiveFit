import type { IconName } from '@/components/Icon';
import type { ActivityType } from '@/db/schema';

export type Measure = 'pace' | 'speed';

type ActivityInfo = {
  label: string;
  /** Lower-case word for sentences: "Morning ride", "recording your hike". */
  word: string;
  icon: IconName;
  /** Runners think in pace (min/km); cyclists in speed (km/h). */
  measure: Measure;
  /** One line for the activity picker. */
  description: string;
};

export const ACTIVITY_DISPLAY: Record<ActivityType, ActivityInfo> = {
  run: {
    label: 'Run',
    word: 'run',
    icon: 'walk',
    measure: 'pace',
    description: 'GPS distance, pace and splits',
  },
  walk: {
    label: 'Walk',
    word: 'walk',
    icon: 'footsteps',
    measure: 'pace',
    description: 'GPS distance and route',
  },
  cycle: {
    label: 'Ride',
    word: 'ride',
    icon: 'bicycle',
    measure: 'speed',
    description: 'GPS distance, speed and climbing',
  },
  hike: {
    label: 'Hike',
    word: 'hike',
    icon: 'trail-sign',
    measure: 'pace',
    description: 'GPS route, distance and elevation',
  },
  wheelchair: {
    label: 'Wheelchair',
    word: 'wheelchair push',
    icon: 'accessibility',
    measure: 'speed',
    description: 'GPS distance, speed and splits',
  },
  strength: {
    label: 'Strength',
    word: 'workout',
    icon: 'barbell',
    measure: 'pace',
    description: 'Exercises, sets, reps and weight',
  },
};

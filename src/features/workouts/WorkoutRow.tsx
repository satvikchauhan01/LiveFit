import { router } from 'expo-router';
import { memo } from 'react';

import { ListRow } from '@/components/ListRow';
import { formatVolume } from '@/features/strength/strengthFormat';
import { formatDistance, formatDuration, formatWorkoutDate } from '@/lib/format';
import type { DistanceUnit, WeightUnit } from '@/lib/units';

import { ACTIVITY_DISPLAY } from './activities';
import type { WorkoutListItem } from './workoutRepository';

type Props = {
  workout: WorkoutListItem;
  distanceUnit: DistanceUnit;
  weightUnit: WeightUnit;
};

/**
 * A finished workout in a list; tapping opens its detail screen.
 * `memo` skips re-rendering rows whose props didn't change, which matters in long lists.
 */
export const WorkoutRow = memo(function WorkoutRow({ workout, distanceUnit, weightUnit }: Props) {
  const activity = ACTIVITY_DISPLAY[workout.type];
  // The headline number: distance for runs and walks, volume lifted for strength.
  const value =
    workout.type === 'strength'
      ? formatVolume(workout.volumeKg ?? 0, weightUnit)
      : formatDistance(workout.distanceM ?? 0, distanceUnit);
  return (
    <ListRow
      icon={activity.icon}
      title={workout.title || activity.label}
      subtitle={`${formatWorkoutDate(workout.startedAt, workout.timezone)} · ${formatDuration((workout.movingS ?? 0) * 1000)}`}
      value={value}
      onPress={() => router.push({ pathname: '/workout/[id]', params: { id: workout.id } })}
    />
  );
});

import { router } from 'expo-router';

import { ListRow } from '@/components/ListRow';
import type { Workout } from '@/db/schema';
import { formatDateTime, formatDistance, formatDuration } from '@/lib/format';
import type { DistanceUnit } from '@/lib/units';

import { ACTIVITY_DISPLAY } from './activities';

type Props = {
  workout: Workout;
  unit: DistanceUnit;
};

/** A finished workout in a list; tapping opens its detail screen. */
export function WorkoutRow({ workout, unit }: Props) {
  return (
    <ListRow
      icon={ACTIVITY_DISPLAY[workout.type].icon}
      title={workout.title || ACTIVITY_DISPLAY[workout.type].label}
      subtitle={`${formatDateTime(workout.startedAt)} · ${formatDuration((workout.movingS ?? 0) * 1000)}`}
      value={formatDistance(workout.distanceM ?? 0, unit)}
      onPress={() => router.push({ pathname: '/workout/[id]', params: { id: workout.id } })}
    />
  );
}

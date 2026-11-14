import { router } from 'expo-router';
import { useMemo } from 'react';

import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { ListRow } from '@/components/ListRow';
import { formatLoad } from '@/features/strength/strengthFormat';
import { useProfile } from '@/features/profile/profileStore';
import { BEST_EFFORT_LABEL } from '@/features/tracking/bestEfforts';
import { ACTIVITY_DISPLAY } from '@/features/workouts/activities';
import { useWorkoutList } from '@/features/workouts/useWorkouts';
import type { WorkoutFilter } from '@/features/workouts/workoutRepository';
import { formatDistance, formatDuration, formatWorkoutDate } from '@/lib/format';
import { useQueryOnFocus } from '@/lib/useQueryOnFocus';

import { allWeightedSets } from './progressRepository';
import { effortRecords, liftRecords, longestByType, mostClimb } from './records';

const ALL: WorkoutFilter = {};

const openWorkout = (id: string) => router.push({ pathname: '/workout/[id]', params: { id } });

/** Personal records: best efforts, longest workouts, most climbing, heaviest lifts. */
export function RecordsView() {
  const profile = useProfile();
  const workouts = useWorkoutList(ALL);
  const sets = useQueryOnFocus(allWeightedSets);

  const records = useMemo(() => {
    if (!workouts) return null;
    return {
      efforts: effortRecords(workouts),
      longest: [...longestByType(workouts).entries()],
      climb: mostClimb(workouts),
      lifts: sets ? liftRecords(sets) : [],
    };
  }, [workouts, sets]);

  if (!records) return null;
  const nothing =
    records.efforts.length === 0 && records.longest.length === 0 && records.lifts.length === 0;
  if (nothing) {
    return (
      <EmptyState
        icon="trophy-outline"
        title="No records yet"
        message="Your fastest times, longest workouts and heaviest lifts will collect here."
      />
    );
  }

  const unit = profile.weightUnit;

  return (
    <>
      {records.efforts.length > 0 && (
        <Card>
          <AppText variant="label" tone="muted">
            Fastest runs
          </AppText>
          {records.efforts.map((record) => (
            <ListRow
              key={record.distanceM}
              icon="trophy-outline"
              title={BEST_EFFORT_LABEL[record.distanceM] ?? `${record.distanceM} m`}
              subtitle={formatWorkoutDate(record.startedAt)}
              value={formatDuration(record.ms)}
              onPress={() => openWorkout(record.workoutId)}
            />
          ))}
        </Card>
      )}

      {(records.longest.length > 0 || records.climb) && (
        <Card>
          <AppText variant="label" tone="muted">
            Longest
          </AppText>
          {records.longest.map(([type, record]) => (
            <ListRow
              key={type}
              icon={ACTIVITY_DISPLAY[type as keyof typeof ACTIVITY_DISPLAY]?.icon ?? 'navigate'}
              title={`Longest ${ACTIVITY_DISPLAY[type as keyof typeof ACTIVITY_DISPLAY]?.word ?? type}`}
              subtitle={formatWorkoutDate(record.startedAt)}
              value={formatDistance(record.valueM, profile.distanceUnit)}
              onPress={() => openWorkout(record.workoutId)}
            />
          ))}
          {records.climb && (
            <ListRow
              icon="trending-up-outline"
              title="Most climbing"
              subtitle={formatWorkoutDate(records.climb.startedAt)}
              value={
                profile.distanceUnit === 'km'
                  ? `${Math.round(records.climb.valueM)} m`
                  : `${Math.round(records.climb.valueM * 3.28084)} ft`
              }
              onPress={() => records.climb && openWorkout(records.climb.workoutId)}
            />
          )}
        </Card>
      )}

      {records.lifts.length > 0 && (
        <Card>
          <AppText variant="label" tone="muted">
            Strength
          </AppText>
          {records.lifts.map((lift) => (
            <ListRow
              key={lift.exerciseId}
              icon="barbell-outline"
              title={lift.name}
              subtitle={
                lift.bestOneRepMaxKg !== null
                  ? `Estimated 1RM ${formatLoad(lift.bestOneRepMaxKg, unit)} ${unit}`
                  : formatWorkoutDate(lift.startedAt)
              }
              value={`${formatLoad(lift.heaviestKg, unit)} ${unit} × ${lift.heaviestReps}`}
              onPress={() => openWorkout(lift.workoutId)}
            />
          ))}
        </Card>
      )}
    </>
  );
}

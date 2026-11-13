import { router } from 'expo-router';

import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { useProfile } from '@/features/profile/profileStore';
import { useFinishedWorkouts } from '@/features/workouts/useWorkouts';
import { WorkoutRow } from '@/features/workouts/WorkoutRow';

// A plain list for now. Phase 3 groups it by week and adds filters.
export default function HistoryScreen() {
  const unit = useProfile().distanceUnit;
  const workouts = useFinishedWorkouts();

  if (workouts === null) {
    return <Screen>{null}</Screen>; // still loading; usually too quick to notice
  }

  if (workouts.length === 0) {
    return (
      <Screen>
        <EmptyState
          icon="time-outline"
          title="No workouts yet"
          message="Your runs, walks and gym sessions will appear here, newest first."
          actionLabel="Start a workout"
          onAction={() => router.push('/record')}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Card>
        {workouts.map((workout) => (
          <WorkoutRow key={workout.id} workout={workout} unit={unit} />
        ))}
      </Card>
    </Screen>
  );
}

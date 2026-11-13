import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { StatTile } from '@/components/StatTile';
import { useProfile } from '@/features/profile/profileStore';
import { useRecorderStore } from '@/features/recorder/recorderStore';
import { ACTIVITY_DISPLAY } from '@/features/workouts/activities';
import { useFinishedWorkouts, useTotalsSince } from '@/features/workouts/useWorkouts';
import { WorkoutRow } from '@/features/workouts/WorkoutRow';
import { startOfWeek } from '@/lib/dates';
import { formatDistance, formatDuration } from '@/lib/format';
import { colors, spacing } from '@/theme/tokens';

function greetingFor(hour: number): string {
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function HomeScreen() {
  const profile = useProfile();
  const liveWorkout = useRecorderStore((state) => (state.phase === 'live' ? state.workout : null));
  const now = new Date();
  const greeting = greetingFor(now.getHours());
  const today = now.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const week = useTotalsSince(startOfWeek(now).getTime());
  const recent = useFinishedWorkouts(3);

  return (
    <Screen edges={['top']}>
      <View>
        <AppText variant="caption" tone="muted">
          {today}
        </AppText>
        <AppText variant="headline">
          {profile.displayName ? `${greeting}, ${profile.displayName}` : greeting}
        </AppText>
      </View>

      {liveWorkout && (
        <Card
          onPress={() => router.push('/recording')}
          accessibilityLabel="Workout in progress. Open it."
          style={styles.liveCard}
        >
          <AppText variant="label" tone="accent">
            Recording now
          </AppText>
          <AppText variant="title">{ACTIVITY_DISPLAY[liveWorkout.type].label} in progress</AppText>
          <AppText tone="muted">Tap to go back to your workout.</AppText>
        </Card>
      )}

      <View style={styles.section}>
        <AppText variant="label" tone="muted">
          This week
        </AppText>
        <View style={styles.row}>
          <StatTile label="Workouts" value={String(week?.count ?? 0)} />
          <StatTile
            label="Distance"
            value={formatDistance(week?.distanceM ?? 0, profile.distanceUnit)}
          />
        </View>
        <View style={styles.row}>
          <StatTile label="Time" value={formatDuration((week?.movingS ?? 0) * 1000)} />
          {/* Strength sessions arrive in Phase 4. */}
          <StatTile label="Strength" value="0" />
        </View>
      </View>

      {!liveWorkout && <Button label="Start workout" onPress={() => router.push('/record')} />}

      <View style={styles.section}>
        <AppText variant="label" tone="muted">
          Recent workouts
        </AppText>
        <Card>
          {recent && recent.length > 0 ? (
            recent.map((workout) => (
              <WorkoutRow key={workout.id} workout={workout} unit={profile.distanceUnit} />
            ))
          ) : (
            <EmptyState
              icon="flash-outline"
              title="No workouts yet"
              message="Your first run, walk or gym session will show up here."
            />
          )}
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  liveCard: {
    borderWidth: 1,
    borderColor: colors.accent,
  },
});

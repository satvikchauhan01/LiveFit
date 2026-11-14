import { router } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { useProfile } from '@/features/profile/profileStore';
import { formatVolume } from '@/features/strength/strengthFormat';
import { startStrengthWorkout } from '@/features/strength/startStrengthWorkout';
import { useActiveSession } from '@/features/workouts/activeSession';
import { ACTIVITY_DISPLAY } from '@/features/workouts/activities';
import { useWorkoutList } from '@/features/workouts/useWorkouts';
import { addUp, countByWeek, weekOf, weeklyStreak } from '@/features/workouts/weeks';
import type { WorkoutFilter } from '@/features/workouts/workoutRepository';
import { WorkoutRow } from '@/features/workouts/WorkoutRow';
import { currentWeekKey } from '@/lib/dates';
import { formatDistance, formatDuration } from '@/lib/format';
import { colors, radius, spacing } from '@/theme/tokens';

// Defined once, outside the component, so it's the same object on every render.
const ALL_WORKOUTS: WorkoutFilter = {};

function greetingFor(hour: number): string {
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function HomeScreen() {
  const profile = useProfile();
  const active = useActiveSession();
  const now = new Date();
  const greeting = greetingFor(now.getHours());
  const today = now.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  // Every finished workout (only the list columns). Fine for a personal log;
  // the streak needs to look back week by week until a week misses the goal.
  const workouts = useWorkoutList(ALL_WORKOUTS);
  const thisWeek = currentWeekKey();
  const goal = profile.weeklyGoal;

  const stats = useMemo(() => {
    if (!workouts) return null;
    const thisWeeksWorkouts = workouts.filter((workout) => weekOf(workout) === thisWeek);
    const strength = thisWeeksWorkouts.filter((workout) => workout.type === 'strength');
    return {
      week: addUp(thisWeeksWorkouts),
      strengthSessions: strength.length,
      volumeKg: strength.reduce((sum, workout) => sum + (workout.volumeKg ?? 0), 0),
      streak: weeklyStreak(countByWeek(workouts), thisWeek, goal),
      recent: workouts.slice(0, 3),
      // Quick start offers whatever you did last.
      lastActivity: workouts[0]?.type ?? 'run',
    };
  }, [workouts, thisWeek, goal]);

  const week = stats?.week ?? { count: 0, distanceM: 0, movingS: 0 };
  const progress = Math.min(1, week.count / goal);
  const lastActivity = stats?.lastActivity ?? 'run';
  const quickStart = ACTIVITY_DISPLAY[lastActivity];

  const handleQuickStart = async () => {
    if (lastActivity === 'strength') {
      if (await startStrengthWorkout()) router.push('/strength');
      return;
    }
    router.push({ pathname: '/record/ready', params: { activity: lastActivity } });
  };

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

      {active && (
        <Card
          onPress={() => router.push(active.route)}
          accessibilityLabel="Workout in progress. Open it."
          style={styles.liveCard}
        >
          <AppText variant="label" tone="accent">
            {active.type === 'strength' ? 'Workout open' : 'Recording now'}
          </AppText>
          <AppText variant="title">{ACTIVITY_DISPLAY[active.type].label} in progress</AppText>
          <AppText tone="muted">Tap to go back to your workout.</AppText>
        </Card>
      )}

      <Card>
        <View style={styles.weekHeader}>
          <AppText variant="label" tone="muted">
            This week
          </AppText>
          <Streak weeks={stats?.streak ?? 0} />
        </View>

        <View
          accessible
          accessibilityLabel={`${week.count} of ${goal} workouts this week`}
          style={styles.goal}
        >
          <AppText variant="headline" numeric>
            {week.count} of {goal} workouts
          </AppText>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
          <AppText variant="caption" tone={progress >= 1 ? 'accent' : 'muted'}>
            {progress >= 1
              ? 'Weekly goal reached. This week counts towards your streak.'
              : `${goal - week.count} more to reach your weekly goal.`}
          </AppText>
        </View>

        <View style={styles.row}>
          <InlineStat
            label="Distance"
            value={formatDistance(week.distanceM, profile.distanceUnit)}
          />
          <InlineStat label="Time" value={formatDuration(week.movingS * 1000)} />
        </View>
        <View style={styles.row}>
          <InlineStat label="Strength sessions" value={String(stats?.strengthSessions ?? 0)} />
          <InlineStat
            label="Volume lifted"
            value={formatVolume(stats?.volumeKg ?? 0, profile.weightUnit)}
          />
        </View>
      </Card>

      {!active && (
        <View style={styles.quickStart}>
          <Button
            label={
              lastActivity === 'strength'
                ? 'Start strength workout'
                : `Start ${quickStart.label.toLowerCase()}`
            }
            onPress={handleQuickStart}
          />
          <Button
            label="Choose another workout"
            variant="secondary"
            onPress={() => router.push('/record')}
          />
        </View>
      )}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <AppText variant="label" tone="muted">
            Recent workouts
          </AppText>
          {stats && stats.recent.length > 0 && (
            <AppText
              variant="label"
              tone="accent"
              accessibilityRole="link"
              onPress={() => router.navigate('/history')}
            >
              See all
            </AppText>
          )}
        </View>
        <Card>
          {stats && stats.recent.length > 0 ? (
            stats.recent.map((workout) => (
              <WorkoutRow
                key={workout.id}
                workout={workout}
                distanceUnit={profile.distanceUnit}
                weightUnit={profile.weightUnit}
              />
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

function Streak({ weeks }: { weeks: number }) {
  if (weeks === 0) {
    return (
      <AppText variant="caption" tone="muted">
        No streak yet
      </AppText>
    );
  }
  return (
    <View style={styles.streak} accessible accessibilityLabel={`${weeks} week streak`}>
      <Icon name="flame" size={16} color={colors.accent} />
      <AppText variant="caption" tone="accent">
        {weeks}-week streak
      </AppText>
    </View>
  );
}

function InlineStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.inlineStat} accessible accessibilityLabel={`${label}: ${value}`}>
      <AppText variant="title" numeric>
        {value}
      </AppText>
      <AppText variant="label" tone="muted">
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  liveCard: {
    borderWidth: 1,
    borderColor: colors.accent,
  },
  weekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  goal: {
    gap: spacing.sm,
  },
  progressTrack: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
    overflow: 'hidden',
  },
  progressFill: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  inlineStat: {
    flex: 1,
    gap: 2,
  },
  quickStart: {
    gap: spacing.sm,
  },
});

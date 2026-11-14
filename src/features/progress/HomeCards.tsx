import { router } from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { useProfile } from '@/features/profile/profileStore';
import { listWorkouts } from '@/features/workouts/workoutRepository';
import { useQueryOnFocus } from '@/lib/useQueryOnFocus';
import { colors, radius, spacing } from '@/theme/tokens';

import { GOAL_KIND_LABEL, loadGoalProgress } from './goals';
import { planStatus } from './planStatus';
import { getActiveEnrollment } from './progressRepository';
import { startPlanSession } from './startPlanSession';

/** Today's session from the plan you're following, with a Start button. */
export function PlanCard({ disabled }: { disabled: boolean }) {
  const status = useQueryOnFocus(
    useCallback(async () => {
      const enrollment = await getActiveEnrollment();
      return enrollment ? planStatus(enrollment, await listWorkouts()) : null;
    }, []),
  );

  if (!status) return null;

  return (
    <Card onPress={() => router.push('/plans')} accessibilityLabel={`Plan: ${status.plan.name}`}>
      <AppText variant="label" tone="accent">
        {status.plan.name}
        {status.finished ? '' : ` · Week ${status.weekIndex + 1} of ${status.plan.weeks.length}`}
      </AppText>
      {status.finished ? (
        <AppText>Plan complete. Pick a new one to keep the momentum.</AppText>
      ) : status.next ? (
        <>
          <AppText variant="title">{status.next.title}</AppText>
          <AppText tone="muted">{status.next.description}</AppText>
          {!disabled && (
            <Button
              label="Start session"
              onPress={() => status.next && startPlanSession(status.next)}
            />
          )}
        </>
      ) : (
        <AppText>All of this week’s sessions are done. Rest up!</AppText>
      )}
    </Card>
  );
}

/** The first couple of goals with progress bars. */
export function GoalsCard() {
  const profile = useProfile();
  const goals = useQueryOnFocus(
    useCallback(
      () => loadGoalProgress({ distance: profile.distanceUnit, weight: profile.weightUnit }),
      [profile.distanceUnit, profile.weightUnit],
    ),
  );
  if (!goals || goals.length === 0) return null;

  return (
    <Card onPress={() => router.push('/goals')} accessibilityLabel="Goals">
      <AppText variant="label" tone="muted">
        Goals
      </AppText>
      {goals.slice(0, 3).map(({ goal, progress }) => (
        <View key={goal.id} style={styles.goal}>
          <AppText>{GOAL_KIND_LABEL[goal.kind]}</AppText>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${progress.fraction * 100}%` }]} />
          </View>
          <AppText variant="caption" tone={progress.fraction >= 1 ? 'accent' : 'muted'}>
            {progress.text}
          </AppText>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  goal: {
    gap: spacing.xs,
  },
  track: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
    overflow: 'hidden',
  },
  fill: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
});

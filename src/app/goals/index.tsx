import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { useProfile } from '@/features/profile/profileStore';
import { GOAL_KIND_LABEL, loadGoalProgress } from '@/features/progress/goals';
import { deleteGoal } from '@/features/progress/progressRepository';
import { useQueryOnFocus } from '@/lib/useQueryOnFocus';
import { colors, minTouchTarget, radius, spacing } from '@/theme/tokens';

export default function GoalsScreen() {
  const profile = useProfile();
  const [version, setVersion] = useState(0);
  const goals = useQueryOnFocus(
    useCallback(
      () => loadGoalProgress({ distance: profile.distanceUnit, weight: profile.weightUnit }),
      // `version` reloads the list after a delete.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [profile.distanceUnit, profile.weightUnit, version],
    ),
  );

  const confirmDelete = (id: string, label: string) =>
    Alert.alert(`Delete “${label}”?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteGoal(id);
          setVersion((value) => value + 1);
        },
      },
    ]);

  return (
    <Screen edges={['bottom']}>
      {goals && goals.length === 0 && (
        <EmptyState
          icon="flag-outline"
          title="No goals yet"
          message="Set a target, like 20 km a week or a 100 kg squat, and watch the bar fill up."
        />
      )}
      {goals?.map(({ goal, progress }) => (
        <Card key={goal.id}>
          <View style={styles.header}>
            <AppText variant="title" style={styles.flex}>
              {GOAL_KIND_LABEL[goal.kind]}
            </AppText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Delete goal: ${GOAL_KIND_LABEL[goal.kind]}`}
              onPress={() => confirmDelete(goal.id, GOAL_KIND_LABEL[goal.kind])}
              style={styles.iconButton}
            >
              <Icon name="trash-outline" size={20} />
            </Pressable>
          </View>
          <View
            style={styles.track}
            accessible
            accessibilityLabel={`${Math.round(progress.fraction * 100)} percent`}
          >
            <View style={[styles.fill, { width: `${progress.fraction * 100}%` }]} />
          </View>
          <AppText tone={progress.fraction >= 1 ? 'accent' : 'muted'}>
            {progress.fraction >= 1 ? 'Reached! ' : ''}
            {progress.text}
          </AppText>
        </Card>
      ))}
      <Button label="Add a goal" onPress={() => router.push('/goals/new')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  flex: {
    flex: 1,
  },
  iconButton: {
    width: minTouchTarget,
    height: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -spacing.md,
  },
  track: {
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
    overflow: 'hidden',
  },
  fill: {
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
});

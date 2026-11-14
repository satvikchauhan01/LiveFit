import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { listWorkouts } from '@/features/workouts/workoutRepository';
import { useQueryOnFocus } from '@/lib/useQueryOnFocus';
import { colors, spacing } from '@/theme/tokens';

import { allWeightedSets } from './progressRepository';
import { newRecordsIn } from './records';

/** "New record: Fastest 5 km" on the summary of a workout that set one. */
export function RecordCelebration({ workoutId }: { workoutId: string }) {
  const records = useQueryOnFocus(
    useCallback(async () => {
      const [workouts, sets] = await Promise.all([listWorkouts(), allWeightedSets()]);
      return newRecordsIn(workoutId, workouts, sets);
    }, [workoutId]),
  );

  if (!records || records.length === 0) return null;

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Icon name="trophy" color={colors.accent} />
        <AppText variant="title">
          {records.length === 1
            ? 'New personal record!'
            : `${records.length} new personal records!`}
        </AppText>
      </View>
      {records.map((record) => (
        <AppText key={record} tone="accent">
          {record}
        </AppText>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.accent,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
});

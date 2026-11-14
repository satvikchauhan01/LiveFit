import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { StatTile } from '@/components/StatTile';
import type { Workout } from '@/db/schema';
import { formatDuration } from '@/lib/format';
import type { WeightUnit } from '@/lib/units';
import { spacing } from '@/theme/tokens';

import { formatSet, formatSetsSummary, formatVolume } from './strengthFormat';
import { sessionTotals } from './strengthMath';
import type { ExerciseLog } from './strengthRepository';

type Props = {
  workout: Workout;
  exercises: ExerciseLog[];
  unit: WeightUnit;
};

/** Duration, exercises, sets and volume of a finished strength workout, then every set. */
export function StrengthSummary({ workout, exercises, unit }: Props) {
  const totals = sessionTotals(exercises);

  return (
    <>
      <View style={styles.grid}>
        <View style={styles.row}>
          <StatTile label="Duration" value={formatDuration((workout.movingS ?? 0) * 1000)} />
          <StatTile label="Volume" value={formatVolume(totals.volumeKg, unit)} />
        </View>
        <View style={styles.row}>
          <StatTile label="Exercises" value={String(totals.exercises)} />
          <StatTile label="Sets" value={String(totals.sets)} />
        </View>
      </View>

      {exercises.length === 0 && (
        <AppText tone="muted">No sets were ticked off in this workout.</AppText>
      )}

      {exercises.map((log) => (
        <Card key={log.order}>
          <View>
            <AppText variant="title">{log.exercise.name}</AppText>
            <AppText variant="caption" tone="muted">
              {formatSetsSummary(log.sets, log.exercise.logType, unit)}
            </AppText>
          </View>
          {log.sets.map((set, index) => (
            <View key={set.id} style={styles.setRow}>
              <AppText tone="muted" numeric style={styles.setNumber}>
                {index + 1}
              </AppText>
              <AppText numeric>{formatSet(set, log.exercise.logType, unit)}</AppText>
            </View>
          ))}
        </Card>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  grid: {
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  setRow: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  setNumber: {
    width: 24,
  },
});

import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import type { WeightUnit } from '@/lib/units';
import { minTouchTarget, spacing } from '@/theme/tokens';

import { EQUIPMENT_LABEL, MUSCLE_GROUP_LABEL } from './builtInExercises';
import type { SetField } from './setInput';
import { fieldsFor, SetRow } from './SetRow';
import { formatSetsSummary } from './strengthFormat';
import { type SessionExercise, useStrengthStore } from './strengthStore';

type Props = {
  entry: SessionExercise;
  unit: WeightUnit;
};

function columnTitle(field: SetField, unit: WeightUnit): string {
  if (field === 'load') return unit;
  return field === 'reps' ? 'Reps' : 'Seconds';
}

/** One exercise in the active session: last-time hint, set rows, "Add set". */
export function ExerciseCard({ entry, unit }: Props) {
  const saveSet = useStrengthStore((state) => state.saveSet);
  const completeSet = useStrengthStore((state) => state.completeSet);
  const reopenSet = useStrengthStore((state) => state.reopenSet);
  const deleteSet = useStrengthStore((state) => state.deleteSet);
  const addSet = useStrengthStore((state) => state.addSet);
  const removeExercise = useStrengthStore((state) => state.removeExercise);

  const { exercise } = entry;

  const confirmRemove = () =>
    Alert.alert(`Remove ${exercise.name}?`, 'Its sets in this workout will be deleted.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeExercise(entry.order) },
    ]);

  return (
    <Card>
      <View style={styles.header}>
        <View style={styles.titleBlock}>
          <AppText variant="title">{exercise.name}</AppText>
          <AppText variant="caption" tone="muted">
            {MUSCLE_GROUP_LABEL[exercise.muscleGroup]} · {EQUIPMENT_LABEL[exercise.equipment]}
          </AppText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Remove ${exercise.name}`}
          onPress={confirmRemove}
          style={styles.iconButton}
        >
          <Icon name="trash-outline" size={20} />
        </Pressable>
      </View>

      {entry.lastTime.length > 0 && (
        <AppText variant="caption" tone="accent">
          Last time: {formatSetsSummary(entry.lastTime, exercise.logType, unit)}
        </AppText>
      )}

      <View style={styles.columns} importantForAccessibility="no-hide-descendants">
        <AppText variant="label" tone="muted" style={styles.setColumn}>
          Set
        </AppText>
        {fieldsFor(exercise.logType).map((field) => (
          <AppText key={field} variant="label" tone="muted" style={styles.fieldColumn}>
            {columnTitle(field, unit)}
          </AppText>
        ))}
        <View style={styles.checkColumn} />
      </View>

      {entry.sets.map((set, index) => (
        <SetRow
          // A new key per unit, so switching kg ↔ lb refills the fields converted.
          key={`${set.id}:${unit}`}
          number={index + 1}
          set={set}
          logType={exercise.logType}
          unit={unit}
          onSave={saveSet}
          onComplete={completeSet}
          onReopen={reopenSet}
          onDelete={deleteSet}
        />
      ))}

      <Button label="+ Add set" variant="ghost" onPress={() => addSet(entry.order)} />
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  titleBlock: {
    flex: 1,
    gap: 2,
  },
  iconButton: {
    width: minTouchTarget,
    height: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -spacing.md,
    marginRight: -spacing.md,
  },
  columns: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  setColumn: {
    width: 32,
    textAlign: 'center',
  },
  fieldColumn: {
    flex: 1,
    textAlign: 'center',
  },
  checkColumn: {
    width: minTouchTarget,
  },
});

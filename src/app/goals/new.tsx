import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { GOAL_KINDS, type GoalKind, GPS_ACTIVITY_TYPES } from '@/db/schema';
import { useProfile } from '@/features/profile/profileStore';
import { GOAL_KIND_LABEL } from '@/features/progress/goals';
import { createGoal } from '@/features/progress/progressRepository';
import { listExercises } from '@/features/strength/strengthRepository';
import { ACTIVITY_DISPLAY } from '@/features/workouts/activities';
import { useQueryOnFocus } from '@/lib/useQueryOnFocus';
import { metersPerUnit, toKg } from '@/lib/units';
import { spacing } from '@/theme/tokens';

export default function NewGoalScreen() {
  const profile = useProfile();
  const [kind, setKind] = useState<GoalKind>('workouts_week');
  const [target, setTarget] = useState('');
  const [activityType, setActivityType] = useState<string | null>(null);
  const [exerciseId, setExerciseId] = useState<string | null>(null);
  const [error, setError] = useState<string | undefined>();
  const allExercises = useQueryOnFocus(listExercises);
  const weighted = useMemo(
    () => (allExercises ?? []).filter((exercise) => exercise.logType === 'weight_reps'),
    [allExercises],
  );

  const unitLabel =
    kind === 'workouts_week'
      ? 'workouts'
      : kind === 'duration_week'
        ? 'hours'
        : kind === 'lift'
          ? profile.weightUnit
          : profile.distanceUnit;

  const save = async () => {
    const value = Number(target.replace(',', '.'));
    if (!Number.isFinite(value) || value <= 0) {
      setError('Enter a number above zero.');
      return;
    }
    if (kind === 'lift' && !exerciseId) {
      setError('Pick the exercise.');
      return;
    }
    // Stored in base units: metres, seconds, kilograms.
    const stored =
      kind === 'distance_week' || kind === 'distance_month'
        ? value * metersPerUnit(profile.distanceUnit)
        : kind === 'duration_week'
          ? value * 3600
          : kind === 'lift'
            ? toKg(value, profile.weightUnit)
            : Math.round(value);
    try {
      await createGoal({
        kind,
        target: stored,
        activityType: kind.startsWith('distance') ? activityType : null,
        exerciseId: kind === 'lift' ? exerciseId : null,
      });
      router.back();
    } catch (failure) {
      Alert.alert('Couldn’t save the goal', String(failure));
    }
  };

  return (
    <Screen edges={['bottom']}>
      <View style={styles.group}>
        <AppText variant="label" tone="muted">
          Kind of goal
        </AppText>
        <View style={styles.chips}>
          {GOAL_KINDS.map((option) => (
            <Chip
              key={option}
              label={GOAL_KIND_LABEL[option]}
              selected={kind === option}
              onPress={() => {
                setKind(option);
                setError(undefined);
              }}
            />
          ))}
        </View>
      </View>

      {kind.startsWith('distance') && (
        <View style={styles.group}>
          <AppText variant="label" tone="muted">
            Counting
          </AppText>
          <View style={styles.chips}>
            <Chip
              label="All cardio"
              selected={activityType === null}
              onPress={() => setActivityType(null)}
            />
            {GPS_ACTIVITY_TYPES.map((type) => (
              <Chip
                key={type}
                label={ACTIVITY_DISPLAY[type].label}
                selected={activityType === type}
                onPress={() => setActivityType(type)}
              />
            ))}
          </View>
        </View>
      )}

      {kind === 'lift' && (
        <View style={styles.group}>
          <AppText variant="label" tone="muted">
            Exercise
          </AppText>
          <View style={styles.chips}>
            {weighted.map((exercise) => (
              <Chip
                key={exercise.id}
                label={exercise.name}
                selected={exerciseId === exercise.id}
                onPress={() => setExerciseId(exercise.id)}
              />
            ))}
          </View>
        </View>
      )}

      <TextField
        label="Target"
        value={target}
        onChangeText={(text) => {
          setTarget(text);
          setError(undefined);
        }}
        keyboardType="decimal-pad"
        suffix={unitLabel}
        error={error}
      />
      <Button label="Save goal" onPress={save} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});

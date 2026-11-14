import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Screen } from '@/components/Screen';
import { SegmentedControl } from '@/components/SegmentedControl';
import { TextField } from '@/components/TextField';
import {
  EQUIPMENT,
  type Equipment,
  type LogType,
  MUSCLE_GROUPS,
  type MuscleGroup,
} from '@/db/schema';
import { EQUIPMENT_LABEL, MUSCLE_GROUP_LABEL } from '@/features/strength/builtInExercises';
import { createCustomExercise, findExerciseByName } from '@/features/strength/strengthRepository';
import { useStrengthStore } from '@/features/strength/strengthStore';
import { spacing } from '@/theme/tokens';

/** Bodyweight moves are usually logged as reps; everything else as weight and reps. */
function defaultLogType(equipment: Equipment): LogType {
  return equipment === 'bodyweight' ? 'reps' : 'weight_reps';
}

export default function NewExerciseScreen() {
  const params = useLocalSearchParams<{ name?: string }>();
  const addExercise = useStrengthStore((state) => state.addExercise);
  const sessionOpen = useStrengthStore((state) => state.workout !== null);

  const [name, setName] = useState(params.name ?? '');
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup | null>(null);
  const [equipment, setEquipment] = useState<Equipment>('barbell');
  const [logType, setLogType] = useState<LogType>('weight_reps');
  const [logTypeChosen, setLogTypeChosen] = useState(false);
  const [nameError, setNameError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  const chooseEquipment = (value: Equipment) => {
    setEquipment(value);
    // Follow the equipment until the user picks a logging style themselves.
    if (!logTypeChosen) setLogType(defaultLogType(value));
  };

  const save = async () => {
    const trimmed = name.trim();
    if (trimmed === '') {
      setNameError('Give the exercise a name.');
      return;
    }
    if (!muscleGroup) {
      Alert.alert('Pick a muscle group', 'It decides where the exercise appears in the list.');
      return;
    }
    setSaving(true);
    try {
      if (await findExerciseByName(trimmed)) {
        setNameError(`There’s already an exercise called “${trimmed}”.`);
        setSaving(false);
        return;
      }
      const exercise = await createCustomExercise({
        name: trimmed,
        muscleGroup,
        equipment,
        logType,
      });
      if (sessionOpen) {
        // Add it straight to the workout and close both this screen and the picker.
        await addExercise(exercise);
        router.dismiss(2);
      } else {
        router.back();
      }
    } catch (error) {
      setSaving(false);
      Alert.alert('Couldn’t save exercise', String(error));
    }
  };

  return (
    <Screen edges={['bottom']}>
      <TextField
        label="Name"
        value={name}
        onChangeText={(text) => {
          setName(text);
          setNameError(undefined);
        }}
        placeholder="e.g. Cable Lateral Raise"
        autoCapitalize="words"
        maxLength={50}
        error={nameError}
      />

      <View style={styles.group}>
        <AppText variant="label" tone="muted">
          Muscle group
        </AppText>
        <View style={styles.chips}>
          {MUSCLE_GROUPS.map((group) => (
            <Chip
              key={group}
              label={MUSCLE_GROUP_LABEL[group]}
              selected={muscleGroup === group}
              onPress={() => setMuscleGroup(group)}
            />
          ))}
        </View>
      </View>

      <View style={styles.group}>
        <AppText variant="label" tone="muted">
          Equipment
        </AppText>
        <View style={styles.chips}>
          {EQUIPMENT.map((item) => (
            <Chip
              key={item}
              label={EQUIPMENT_LABEL[item]}
              selected={equipment === item}
              onPress={() => chooseEquipment(item)}
            />
          ))}
        </View>
      </View>

      <View style={styles.group}>
        <AppText variant="label" tone="muted">
          Log sets as
        </AppText>
        <SegmentedControl
          accessibilityLabel="Log sets as"
          options={[
            { value: 'weight_reps', label: 'Weight' },
            { value: 'reps', label: 'Reps' },
            { value: 'time', label: 'Time' },
          ]}
          value={logType}
          onChange={(value) => {
            setLogType(value);
            setLogTypeChosen(true);
          }}
        />
        <AppText variant="caption" tone="muted">
          {logType === 'weight_reps'
            ? 'Weight and reps for each set, e.g. 60 kg × 8.'
            : logType === 'reps'
              ? 'Reps only, e.g. 12 push-ups.'
              : 'A duration for each set, e.g. a 45-second plank.'}
        </AppText>
      </View>

      <Button label={saving ? 'Saving…' : 'Save exercise'} onPress={save} disabled={saving} />
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

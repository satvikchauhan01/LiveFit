import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Screen } from '@/components/Screen';
import { Stepper } from '@/components/Stepper';
import { TextField } from '@/components/TextField';
import { ACTIVITY_TYPES, type ActivityType, isGpsActivityType } from '@/db/schema';
import { useProfile } from '@/features/profile/profileStore';
import { formatClock } from '@/features/reminders/reminderSchedule';
import { ACTIVITY_DISPLAY } from '@/features/workouts/activities';
import { createFinishedWorkout } from '@/features/workouts/workoutRepository';
import { defaultWorkoutTitle } from '@/features/workouts/workoutTitle';
import { estimateCalories } from '@/lib/calories';
import { metersPerUnit } from '@/lib/units';
import { spacing } from '@/theme/tokens';

const DAY_OPTIONS = [
  { offset: 0, label: 'Today' },
  { offset: 1, label: 'Yesterday' },
  { offset: 2, label: '2 days ago' },
  { offset: 3, label: '3 days ago' },
  { offset: 7, label: 'A week ago' },
];

function parsePositive(text: string): number | null {
  const value = Number(text.trim().replace(',', '.'));
  return text.trim() !== '' && Number.isFinite(value) && value >= 0 ? value : null;
}

/** A workout recorded somewhere else (or forgotten): typed in by hand. */
export default function ManualWorkoutScreen() {
  const profile = useProfile();
  const [type, setType] = useState<ActivityType>('run');
  const [dayOffset, setDayOffset] = useState(0);
  // Start time in minutes after midnight, rounded to a quarter hour, an hour ago.
  const [startMinutes, setStartMinutes] = useState(() => {
    const now = new Date();
    return Math.max(0, Math.floor((now.getHours() * 60 + now.getMinutes() - 60) / 15) * 15);
  });
  const [hours, setHours] = useState('0');
  const [minutes, setMinutes] = useState('30');
  const [distance, setDistance] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  const hasDistance = isGpsActivityType(type);

  const save = async () => {
    const durationS = ((parsePositive(hours) ?? 0) * 60 + (parsePositive(minutes) ?? 0)) * 60;
    if (durationS <= 0) {
      setError('Enter how long it took.');
      return;
    }
    const distanceValue = hasDistance ? parsePositive(distance) : null;
    if (hasDistance && (distanceValue === null || distanceValue <= 0)) {
      setError(`Enter the distance in ${profile.distanceUnit}.`);
      return;
    }

    const day = new Date();
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - dayOffset);
    const startedAt = day.getTime() + startMinutes * 60_000;
    if (startedAt + durationS * 1000 > Date.now()) {
      setError('That would end in the future. Pick an earlier day or time.');
      return;
    }

    setSaving(true);
    try {
      const distanceM =
        distanceValue !== null ? distanceValue * metersPerUnit(profile.distanceUnit) : null;
      const saved = await createFinishedWorkout({
        type,
        source: 'manual',
        startedAt,
        endedAt: startedAt + durationS * 1000,
        elapsedS: durationS,
        movingS: durationS,
        distanceM,
        caloriesEst: estimateCalories({
          activity: type,
          movingS: durationS,
          distanceM,
          weightKg: profile.weightKg,
        }),
        title: defaultWorkoutTitle(type, startedAt),
        notes: notes.trim(),
      });
      router.dismissAll();
      router.replace({ pathname: '/workout/[id]', params: { id: saved.id } });
    } catch (failure) {
      setSaving(false);
      Alert.alert('Couldn’t save', String(failure));
    }
  };

  return (
    <Screen edges={['bottom']}>
      <View style={styles.group}>
        <AppText variant="label" tone="muted">
          Activity
        </AppText>
        <View style={styles.chips}>
          {ACTIVITY_TYPES.map((activity) => (
            <Chip
              key={activity}
              label={ACTIVITY_DISPLAY[activity].label}
              selected={type === activity}
              onPress={() => setType(activity)}
            />
          ))}
        </View>
      </View>

      <View style={styles.group}>
        <AppText variant="label" tone="muted">
          When
        </AppText>
        <View style={styles.chips}>
          {DAY_OPTIONS.map((option) => (
            <Chip
              key={option.offset}
              label={option.label}
              selected={dayOffset === option.offset}
              onPress={() => setDayOffset(option.offset)}
            />
          ))}
        </View>
        <Stepper
          accessibilityLabel="Start time"
          value={startMinutes}
          min={0}
          max={23 * 60 + 45}
          step={15}
          format={(value) => `Started at ${formatClock(value)}`}
          onChange={setStartMinutes}
        />
      </View>

      <View style={styles.row}>
        <View style={styles.flex}>
          <TextField
            label="Hours"
            value={hours}
            onChangeText={setHours}
            keyboardType="number-pad"
          />
        </View>
        <View style={styles.flex}>
          <TextField
            label="Minutes"
            value={minutes}
            onChangeText={setMinutes}
            keyboardType="number-pad"
          />
        </View>
      </View>

      {hasDistance && (
        <TextField
          label="Distance"
          value={distance}
          onChangeText={setDistance}
          keyboardType="decimal-pad"
          suffix={profile.distanceUnit}
        />
      )}

      <TextField
        label="Notes"
        value={notes}
        onChangeText={setNotes}
        multiline
        placeholder="Optional"
        error={error}
      />

      <AppText variant="caption" tone="muted">
        Logged workouts count towards your week and streak. They don’t count for distance
        leaderboards, which need a recorded GPS route.
      </AppText>

      <Button label={saving ? 'Saving…' : 'Save workout'} onPress={save} disabled={saving} />
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
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  flex: {
    flex: 1,
  },
});

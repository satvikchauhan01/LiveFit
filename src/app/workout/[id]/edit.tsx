import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import type { Workout } from '@/db/schema';
import { getWorkout, updateWorkoutDetails } from '@/features/workouts/workoutRepository';
import { defaultWorkoutTitle } from '@/features/workouts/workoutTitle';
import { spacing } from '@/theme/tokens';

/** Modal for changing a workout's title and notes. Route, times and distance stay as recorded. */
export default function EditWorkoutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getWorkout(id)
      .then((loaded) => {
        if (cancelled || !loaded) return;
        setWorkout(loaded);
        setTitle(loaded.title);
        setNotes(loaded.notes);
      })
      .catch((error: unknown) => Alert.alert('Couldn’t load workout', String(error)));
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (!workout) {
    return <Screen>{null}</Screen>;
  }

  const fallbackTitle = defaultWorkoutTitle(workout.type, workout.startedAt);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateWorkoutDetails(workout.id, {
        title: title.trim() || fallbackTitle,
        notes: notes.trim(),
      });
      router.back();
    } catch (error) {
      setSaving(false);
      Alert.alert('Couldn’t save', String(error));
    }
  };

  return (
    <Screen edges={['bottom']}>
      <TextField
        label="Title"
        value={title}
        onChangeText={setTitle}
        placeholder={fallbackTitle}
        maxLength={60}
        autoFocus
      />
      <TextField
        label="Notes"
        value={notes}
        onChangeText={setNotes}
        placeholder="How did it feel?"
        multiline
        maxLength={1000}
      />
      <View style={styles.actions}>
        <Button label={saving ? 'Saving…' : 'Save'} onPress={handleSave} disabled={saving} />
        <Button label="Cancel" variant="ghost" onPress={() => router.back()} disabled={saving} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: spacing.sm,
  },
});

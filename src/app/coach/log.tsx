import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { CoachLogResult } from '@shared/api';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import type { Exercise } from '@/db/schema';
import { useAccountStore } from '@/features/account/accountStore';
import { errorMessage } from '@/features/account/apiClient';
import { coachApi } from '@/features/coach/coachApi';
import { useCoachConsent } from '@/features/coach/consent';
import { isProUser } from '@/features/pro/proStatus';
import { useProfile } from '@/features/profile/profileStore';
import {
  createCustomExercise,
  findExerciseByName,
  getExercise,
  listExercises,
} from '@/features/strength/strengthRepository';
import { useStrengthStore } from '@/features/strength/strengthStore';
import { formatWeight } from '@/lib/format';
import { spacing } from '@/theme/tokens';

/** "3 × 8 · 60.0 kg" style summary of one exercise's sets. */
function setsText(sets: CoachLogResult['exercises'][number]['sets'], unit: 'kg' | 'lb'): string {
  return sets
    .map((set) =>
      set.durationS !== null
        ? `${set.durationS} s`
        : `${set.reps ?? '?'} reps${set.weightKg !== null ? ` @ ${formatWeight(set.weightKg, unit)}` : ''}`,
    )
    .join(' · ');
}

/** Turns a typed note into sets in the strength workout that's open. */
export default function CoachLogScreen() {
  const profile = useProfile();
  const pro = isProUser(useAccountStore((state) => state.user));
  const consentGiven = useCoachConsent((state) => state.given);
  const setConsent = useCoachConsent((state) => state.setGiven);
  const loadConsent = useCoachConsent((state) => state.load);
  const addDoneSets = useStrengthStore((state) => state.addDoneSets);
  const [note, setNote] = useState('');
  const [result, setResult] = useState<CoachLogResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadConsent();
  }, [loadConsent]);

  if (!pro) {
    return (
      <Screen>
        <EmptyState
          icon="sparkles-outline"
          title="Part of LiveFit Pro"
          message="Type your session like a note, such as “bench 3x8 at 60, pull-ups 3x10”, and the coach fills in the sets."
          actionLabel="See LiveFit Pro"
          onAction={() => router.replace('/pro')}
        />
      </Screen>
    );
  }

  const read = async () => {
    setBusy(true);
    setError(null);
    try {
      // Only the note and exercise names are sent.
      await setConsent(true);
      const exercises = (await listExercises()).map((exercise) => ({
        id: exercise.id,
        name: exercise.name,
      }));
      setResult(await coachApi.log(note.trim(), profile.weightUnit, exercises));
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    if (!result) return;
    setBusy(true);
    try {
      for (const entry of result.exercises) {
        let exercise: Exercise | null = entry.exerciseId
          ? await getExercise(entry.exerciseId)
          : null;
        exercise ??= await findExerciseByName(entry.name);
        const timed = entry.sets.every((set) => set.durationS !== null);
        const weighted = entry.sets.some((set) => set.weightKg !== null);
        exercise ??= await createCustomExercise({
          name: entry.name,
          muscleGroup: 'full_body',
          equipment: weighted ? 'other' : 'bodyweight',
          logType: timed ? 'time' : weighted ? 'weight_reps' : 'reps',
        });
        await addDoneSets(exercise, entry.sets);
      }
      router.back();
    } catch (failure) {
      setError(errorMessage(failure));
      setBusy(false);
    }
  };

  return (
    <Screen edges={['bottom']}>
      <TextField
        label="What did you do?"
        value={note}
        onChangeText={(text) => {
          setNote(text);
          setResult(null);
        }}
        multiline
        maxLength={1000}
        placeholder="Bench 3x8 at 60, squats 5x5 100, plank 3x45s"
        autoFocus
      />
      {consentGiven === false && (
        <AppText variant="caption" tone="muted">
          Your note and the names of your exercises are sent to Anthropic’s Claude AI to read them.
          Nothing else is sent.
        </AppText>
      )}
      {!result && (
        <Button
          label={busy ? 'Reading…' : 'Read my note'}
          onPress={read}
          disabled={busy || note.trim().length < 2}
        />
      )}
      {error && <AppText tone="danger">{error}</AppText>}
      {result && result.exercises.length === 0 && (
        <AppText tone="muted">
          No exercises found in that note. Try naming them and the sets.
        </AppText>
      )}
      {result && result.exercises.length > 0 && (
        <>
          {result.exercises.map((entry, index) => (
            <Card key={`${entry.name}-${index}`}>
              <View style={styles.row}>
                <AppText variant="title" style={styles.flex}>
                  {entry.name}
                </AppText>
                {!entry.exerciseId && (
                  <AppText variant="caption" tone="muted">
                    New exercise
                  </AppText>
                )}
              </View>
              <AppText tone="muted">{setsText(entry.sets, profile.weightUnit)}</AppText>
            </Card>
          ))}
          <Button label={busy ? 'Adding…' : 'Add to workout'} onPress={add} disabled={busy} />
          <Button label="Edit the note" variant="ghost" onPress={() => setResult(null)} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  flex: {
    flex: 1,
  },
});

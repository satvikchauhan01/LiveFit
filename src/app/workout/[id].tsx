import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { ListRow } from '@/components/ListRow';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { useProfile } from '@/features/profile/profileStore';
import { ACTIVITY_DISPLAY } from '@/features/workouts/activities';
import {
  deleteWorkout,
  loadWorkoutDetail,
  updateWorkoutTitle,
  type WorkoutDetail,
} from '@/features/workouts/workoutRepository';
import { WorkoutSummary } from '@/features/workouts/WorkoutSummary';
import { defaultWorkoutTitle } from '@/features/workouts/workoutTitle';
import { formatDateTime } from '@/lib/format';
import { colors, spacing } from '@/theme/tokens';

function close() {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace('/');
  }
}

/**
 * One finished workout. Straight after finishing it opens with `summary=1`:
 * the title can be edited and the workout saved or discarded.
 */
export default function WorkoutScreen() {
  const params = useLocalSearchParams<{ id: string; summary?: string }>();
  const isSummary = params.summary === '1';
  const unit = useProfile().distanceUnit;

  // undefined while loading, null if the workout doesn't exist.
  const [detail, setDetail] = useState<WorkoutDetail | null | undefined>(undefined);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadWorkoutDetail(params.id)
      .then((loaded) => {
        if (!cancelled) {
          setDetail(loaded);
          setTitle(loaded?.workout.title ?? '');
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setDetail(null);
          Alert.alert('Couldn’t load workout', String(error));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  const headerOptions = (
    <Stack.Screen
      options={{
        title: isSummary ? 'Workout saved' : (detail?.workout.title ?? ''),
        headerBackVisible: !isSummary,
        gestureEnabled: !isSummary,
      }}
    />
  );

  if (detail === undefined) {
    return (
      <View style={styles.centered}>
        {headerOptions}
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (detail === null) {
    return (
      <Screen>
        {headerOptions}
        <EmptyState
          icon="alert-circle-outline"
          title="Workout not found"
          message="It may have been deleted."
          actionLabel="Back"
          onAction={close}
        />
      </Screen>
    );
  }

  const { workout } = detail;

  const handleSave = async () => {
    setBusy(true);
    try {
      const finalTitle = title.trim() || defaultWorkoutTitle(workout.type, workout.startedAt);
      if (finalTitle !== workout.title) {
        await updateWorkoutTitle(workout.id, finalTitle);
      }
      close();
    } catch (error) {
      setBusy(false);
      Alert.alert('Couldn’t save', String(error));
    }
  };

  const handleDiscard = () =>
    Alert.alert('Discard workout?', 'It will be deleted. This can’t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          await deleteWorkout(workout.id);
          close();
        },
      },
    ]);

  return (
    <Screen edges={['bottom']}>
      {headerOptions}

      <AppText tone="muted">
        {ACTIVITY_DISPLAY[workout.type].label} · {formatDateTime(workout.startedAt)}
      </AppText>

      {isSummary && (
        <TextField
          label="Title"
          value={title}
          onChangeText={setTitle}
          placeholder={defaultWorkoutTitle(workout.type, workout.startedAt)}
          maxLength={60}
          returnKeyType="done"
        />
      )}

      <WorkoutSummary detail={detail} unit={unit} />

      {isSummary && (
        <View style={styles.actions}>
          <Button label="Save" onPress={handleSave} disabled={busy} />
          <Button label="Discard workout" variant="ghost" onPress={handleDiscard} disabled={busy} />
        </View>
      )}

      {__DEV__ && (
        <Card>
          <AppText variant="label" tone="warning">
            Developer
          </AppText>
          <ListRow
            icon="analytics-outline"
            title="GPS diagnostics"
            subtitle="Raw vs filtered route, dropped points, battery, GPX export"
            onPress={() =>
              router.push({ pathname: '/dev/workout/[id]', params: { id: workout.id } })
            }
          />
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  actions: {
    gap: spacing.sm,
  },
});

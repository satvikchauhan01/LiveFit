import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Icon, type IconName } from '@/components/Icon';
import { ListRow } from '@/components/ListRow';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { isGpsActivityType } from '@/db/schema';
import { useProfile } from '@/features/profile/profileStore';
import { StrengthSummary } from '@/features/strength/StrengthSummary';
import { ACTIVITY_DISPLAY } from '@/features/workouts/activities';
import {
  deleteWorkout,
  loadWorkoutDetail,
  updateWorkoutDetails,
  type WorkoutDetail,
} from '@/features/workouts/workoutRepository';
import { WorkoutSummary } from '@/features/workouts/WorkoutSummary';
import { defaultWorkoutTitle } from '@/features/workouts/workoutTitle';
import { formatWorkoutDate } from '@/lib/format';
import { colors, minTouchTarget, spacing } from '@/theme/tokens';

function close() {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace('/');
  }
}

/**
 * One finished workout. Straight after finishing it opens with `summary=1`:
 * title and notes can be filled in and the workout saved or discarded.
 * Opened from History it shows Edit and Delete in the header instead.
 */
export default function WorkoutScreen() {
  const params = useLocalSearchParams<{ id: string; summary?: string }>();
  const isSummary = params.summary === '1';
  const { distanceUnit, weightUnit } = useProfile();

  // undefined while loading, null if the workout doesn't exist.
  const [detail, setDetail] = useState<WorkoutDetail | null | undefined>(undefined);
  const [draft, setDraft] = useState<{ title: string; notes: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // Reload whenever the screen is shown again, e.g. after editing it.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      loadWorkoutDetail(params.id)
        .then((loaded) => {
          if (cancelled) return;
          setDetail(loaded);
          // Fill the summary fields once; later reloads mustn't wipe what's being typed.
          setDraft(
            (current) =>
              current ?? { title: loaded?.workout.title ?? '', notes: loaded?.workout.notes ?? '' },
          );
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
    }, [params.id]),
  );

  const workout = detail?.workout;

  const confirmDelete = (title: string, message: string) =>
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: isSummary ? 'Discard' : 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!workout) return;
          setBusy(true);
          try {
            await deleteWorkout(workout.id);
            close();
          } catch (error) {
            setBusy(false);
            Alert.alert('Couldn’t delete', String(error));
          }
        },
      },
    ]);

  const headerOptions = (
    <Stack.Screen
      options={{
        title: isSummary ? 'Workout saved' : (workout?.title ?? ''),
        headerBackVisible: !isSummary,
        gestureEnabled: !isSummary,
        headerRight:
          !isSummary && workout
            ? () => (
                <View style={styles.headerButtons}>
                  <HeaderButton
                    icon="create-outline"
                    label="Edit title and notes"
                    onPress={() =>
                      router.push({ pathname: '/workout/[id]/edit', params: { id: workout.id } })
                    }
                  />
                  <HeaderButton
                    icon="trash-outline"
                    label="Delete workout"
                    onPress={() =>
                      confirmDelete(
                        'Delete workout?',
                        'Its route and stats will be deleted. This can’t be undone.',
                      )
                    }
                  />
                </View>
              )
            : undefined,
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

  if (detail === null || !workout) {
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

  const fallbackTitle = defaultWorkoutTitle(workout.type, workout.startedAt);

  const handleSave = async () => {
    if (!draft) return;
    setBusy(true);
    try {
      await updateWorkoutDetails(workout.id, {
        title: draft.title.trim() || fallbackTitle,
        notes: draft.notes.trim(),
      });
      close();
    } catch (error) {
      setBusy(false);
      Alert.alert('Couldn’t save', String(error));
    }
  };

  return (
    <Screen edges={['bottom']}>
      {headerOptions}

      <AppText tone="muted">
        {ACTIVITY_DISPLAY[workout.type].label} ·{' '}
        {formatWorkoutDate(workout.startedAt, workout.timezone)}
      </AppText>

      {isSummary && draft && (
        <>
          <TextField
            label="Title"
            value={draft.title}
            onChangeText={(title) => setDraft({ ...draft, title })}
            placeholder={fallbackTitle}
            maxLength={60}
          />
          <TextField
            label="Notes"
            value={draft.notes}
            onChangeText={(notes) => setDraft({ ...draft, notes })}
            placeholder="How did it feel?"
            multiline
            maxLength={1000}
          />
        </>
      )}

      {!isSummary && workout.notes !== '' && (
        <Card>
          <AppText variant="label" tone="muted">
            Notes
          </AppText>
          <AppText>{workout.notes}</AppText>
        </Card>
      )}

      {isGpsActivityType(workout.type) ? (
        <WorkoutSummary detail={detail} activity={workout.type} unit={distanceUnit} />
      ) : (
        <StrengthSummary workout={workout} exercises={detail.exercises} unit={weightUnit} />
      )}

      {isSummary && (
        <View style={styles.actions}>
          <Button label="Save" onPress={handleSave} disabled={busy} />
          <Button
            label="Discard workout"
            variant="ghost"
            onPress={() =>
              confirmDelete('Discard workout?', 'It will be deleted. This can’t be undone.')
            }
            disabled={busy}
          />
        </View>
      )}

      {__DEV__ && isGpsActivityType(workout.type) && (
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

function HeaderButton({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
    >
      <Icon name={icon} />
    </Pressable>
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
  headerButtons: {
    flexDirection: 'row',
  },
  headerButton: {
    width: minTouchTarget,
    height: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
});

import { router } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { Icon } from '@/components/Icon';
import { useProfile } from '@/features/profile/profileStore';
import { ExerciseCard } from '@/features/strength/ExerciseCard';
import { RestTimerBar } from '@/features/strength/RestTimerBar';
import { useStrengthStore } from '@/features/strength/strengthStore';
import { formatDuration } from '@/lib/format';
import { useNow } from '@/lib/useNow';
import { colors, fontSize, minTouchTarget, spacing } from '@/theme/tokens';

function leaveScreen() {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace('/');
  }
}

/** The strength workout in progress. */
export default function StrengthScreen() {
  const workout = useStrengthStore((state) => state.workout);
  const exercises = useStrengthStore((state) => state.exercises);
  const finish = useStrengthStore((state) => state.finish);
  const discard = useStrengthStore((state) => state.discard);
  const unit = useProfile().weightUnit;
  const now = useNow(1000);
  const [busy, setBusy] = useState(false);

  if (!workout) {
    // Briefly true while leaving after finish or discard.
    return <View style={styles.screen} />;
  }

  const allSets = exercises.flatMap((entry) => entry.sets);
  const doneCount = allSets.filter((set) => set.completedAt !== null).length;
  const openCount = allSets.length - doneCount;

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      setBusy(false);
      Alert.alert('Something went wrong', error instanceof Error ? error.message : String(error));
    }
  };

  const discardAndLeave = () =>
    run(async () => {
      await discard();
      leaveScreen();
    });

  const handleDiscard = () =>
    Alert.alert('Discard workout?', 'Everything logged in it will be deleted.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: discardAndLeave },
    ]);

  const handleFinish = () => {
    // Closing the keyboard saves whatever is still being typed.
    Keyboard.dismiss();
    if (doneCount === 0) {
      Alert.alert(
        'No sets ticked off yet',
        'Tick off at least one set to save this workout, or discard it.',
        [
          { text: 'Keep going', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: discardAndLeave },
        ],
      );
      return;
    }
    const message =
      openCount > 0
        ? `${doneCount} sets will be saved. ${openCount} unticked ${openCount === 1 ? 'set is' : 'sets are'} left out.`
        : `${doneCount} sets will be saved.`;
    Alert.alert('Finish workout?', message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Finish',
        onPress: () =>
          run(async () => {
            const saved = await finish();
            if (saved) {
              router.replace({ pathname: '/workout/[id]', params: { id: saved.id, summary: '1' } });
            } else {
              leaveScreen();
            }
          }),
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Hide the workout screen. The workout stays open."
          hitSlop={12}
          onPress={leaveScreen}
          style={styles.headerButton}
        >
          <Icon name="chevron-down" size={28} />
        </Pressable>
        <View style={styles.headerTitle}>
          <AppText variant="title">Strength</AppText>
          <AppText variant="caption" tone="muted" numeric>
            {formatDuration(now - workout.startedAt)}
          </AppText>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={handleFinish}
          disabled={busy}
          style={({ pressed }) => [styles.finish, pressed && styles.pressed]}
        >
          <AppText style={styles.finishLabel}>Finish</AppText>
        </Pressable>
      </View>

      {/* Moves the content up when the keyboard opens, so the field being typed
          in (and the rest timer) stay visible. */}
      <KeyboardAvoidingView style={styles.fill} behavior="padding">
        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {exercises.length === 0 && (
            <EmptyState
              icon="barbell-outline"
              title="Add your first exercise"
              message="Pick from the list or create your own. Sets you did last time are filled in for you."
            />
          )}

          {exercises.map((entry) => (
            <ExerciseCard key={entry.order} entry={entry} unit={unit} />
          ))}

          <Button
            label="Add exercise"
            variant="secondary"
            onPress={() => router.push('/exercises/pick')}
            disabled={busy}
          />
          <Button label="Discard workout" variant="ghost" onPress={handleDiscard} disabled={busy} />
        </ScrollView>

        <RestTimerBar />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  fill: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  headerButton: {
    width: minTouchTarget,
    height: minTouchTarget,
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    alignItems: 'center',
  },
  finish: {
    minWidth: minTouchTarget,
    height: minTouchTarget,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  finishLabel: {
    color: colors.accent,
    fontSize: fontSize.body,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.6,
  },
  body: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },
});

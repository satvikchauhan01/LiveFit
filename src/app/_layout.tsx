// Registers the background location task as soon as the app's JS loads.
import '@/features/tracking/locationTask';

import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { db } from '@/db/client';
import { useProfileStore } from '@/features/profile/profileStore';
import { useRecorderStore } from '@/features/recorder/recorderStore';
import { parseReminderDays } from '@/features/reminders/reminderSchedule';
import { setUpReminderChannel, syncReminders } from '@/features/reminders/reminders';
import { setUpRestAlertChannel } from '@/features/strength/restAlerts';
import { seedBuiltInExercises } from '@/features/strength/strengthRepository';
import { useStrengthStore } from '@/features/strength/strengthStore';
import { startCrashReporting, withCrashReporting } from '@/lib/crashReporting';
import { colors, spacing } from '@/theme/tokens';

import migrations from '../../drizzle/migrations';

// Keep the splash screen up until the database is ready, the profile is loaded
// and any unfinished workout is found, so the first screen is the right one.
SplashScreen.preventAutoHideAsync();
startCrashReporting();

function RootLayout() {
  const migration = useMigrations(db, migrations);
  const profile = useProfileStore((state) => state.profile);
  const loadProfile = useProfileStore((state) => state.load);
  const recorderRestored = useRecorderStore((state) => state.restored);
  const restoreRecorder = useRecorderStore((state) => state.restore);
  const strengthRestored = useStrengthStore((state) => state.restored);
  const restoreStrength = useStrengthStore((state) => state.restore);
  const [loadError, setLoadError] = useState<Error | null>(null);

  useEffect(() => {
    if (migration.success) {
      // Exercises first: restoring a strength workout reads them.
      seedBuiltInExercises()
        .then(() => Promise.all([loadProfile(), restoreRecorder(), restoreStrength()]))
        .catch((error: unknown) =>
          setLoadError(error instanceof Error ? error : new Error(String(error))),
        );
      Promise.all([setUpRestAlertChannel(), setUpReminderChannel()]).catch((error: unknown) =>
        console.warn('[notifications] channel setup failed', error),
      );
    }
  }, [migration.success, loadProfile, restoreRecorder, restoreStrength]);

  // Once per launch, make the scheduled reminders match the saved settings
  // (e.g. if notification permission was granted in system settings since).
  const remindersReady = profile !== null;
  useEffect(() => {
    if (!remindersReady) return;
    const saved = useProfileStore.getState().profile;
    if (saved) {
      syncReminders(parseReminderDays(saved.reminderDays), saved.reminderMinutes).catch(
        (error: unknown) => console.warn('[reminders] could not schedule', error),
      );
    }
  }, [remindersReady]);

  const failure = migration.error ?? loadError;
  const ready = profile !== null && recorderRestored && strengthRestored;

  useEffect(() => {
    if (ready || failure) {
      SplashScreen.hideAsync();
    }
  }, [ready, failure]);

  if (failure) {
    return <StartupError message={failure.message} />;
  }
  if (!ready) {
    return null; // splash screen is still showing
  }

  const onboarded = profile.onboardedAt !== null;

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        {/* Guards decide which screens exist. Finishing onboarding flips
            `onboarded`, and the router moves to the tabs on its own. */}
        <Stack.Protected guard={onboarded}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="record" options={{ presentation: 'modal', headerShown: false }} />
          {/* The live workout slides up over the tabs. Going back just hides it;
              recording carries on until Finish or Discard. */}
          <Stack.Screen
            name="recording"
            options={{
              headerShown: false,
              presentation: 'fullScreenModal',
              animation: 'slide_from_bottom',
              gestureEnabled: false,
            }}
          />
          <Stack.Screen
            name="strength"
            options={{
              headerShown: false,
              presentation: 'fullScreenModal',
              animation: 'slide_from_bottom',
              gestureEnabled: false,
            }}
          />
          <Stack.Screen
            name="exercises/pick"
            options={{ presentation: 'modal', title: 'Add exercise' }}
          />
          <Stack.Screen
            name="exercises/new"
            options={{ presentation: 'modal', title: 'New exercise' }}
          />
          <Stack.Screen name="workout/[id]" options={{ title: '' }} />
          <Stack.Screen
            name="workout/[id]/edit"
            options={{ presentation: 'modal', title: 'Edit workout' }}
          />

          <Stack.Protected guard={__DEV__}>
            <Stack.Screen name="dev/components" options={{ title: 'Components' }} />
            <Stack.Screen name="dev/workout/[id]" options={{ title: 'GPS diagnostics' }} />
          </Stack.Protected>
        </Stack.Protected>

        <Stack.Protected guard={!onboarded}>
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>
    </>
  );
}

export default withCrashReporting(RootLayout);

function StartupError({ message }: { message: string }) {
  return (
    <View style={styles.error}>
      <StatusBar style="light" />
      <AppText variant="title">LiveFit couldn’t start</AppText>
      <AppText tone="muted">
        Something went wrong while opening your data. Your workouts are still on this phone. Try
        closing and reopening the app.
      </AppText>
      <AppText variant="caption" tone="danger">
        {message}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  error: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
});

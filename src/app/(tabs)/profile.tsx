import Constants from 'expo-constants';
import * as Location from 'expo-location';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Linking, Platform, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { ListRow } from '@/components/ListRow';
import { Screen } from '@/components/Screen';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Stepper } from '@/components/Stepper';
import { SwitchRow } from '@/components/SwitchRow';
import { TextField } from '@/components/TextField';
import { useProfile, useProfileStore } from '@/features/profile/profileStore';
import { parseWeightInput } from '@/features/profile/weight';
import {
  describeReminders,
  formatClock,
  formatReminderDays,
  parseReminderDays,
  toggleDay,
  WEEKDAYS,
} from '@/features/reminders/reminderSchedule';
import { syncReminders } from '@/features/reminders/reminders';
import {
  type AlertPermission,
  getAlertPermission,
  hasExactTiming,
  requestAlertPermission,
  requestExactTiming,
} from '@/features/strength/restAlerts';
import { formatSeconds } from '@/features/strength/strengthFormat';
import { useActiveSession } from '@/features/workouts/activeSession';
import { formatWorkoutCount } from '@/lib/format';
import { fromKg, type WeightUnit } from '@/lib/units';
import { colors, radius, spacing } from '@/theme/tokens';

function weightToText(weightKg: number | null, unit: WeightUnit): string {
  return weightKg !== null ? fromKg(weightKg, unit).toFixed(1) : '';
}

const ALERT_PERMISSION_LABEL: Record<AlertPermission, string> = {
  granted: 'Allowed',
  undetermined: 'Not asked yet',
  denied: 'Not allowed',
  blocked: 'Blocked in settings',
};

function describePermission(permission: Location.LocationPermissionResponse): string {
  if (permission.granted) return 'Allowed';
  if (permission.status === 'undetermined') return 'Not asked yet';
  return permission.canAskAgain ? 'Not allowed' : 'Blocked in settings';
}

type WeightFieldProps = {
  weightKg: number | null;
  unit: WeightUnit;
  onSave: (weightKg: number | null) => void;
};

function WeightField({ weightKg, unit, onSave }: WeightFieldProps) {
  const [text, setText] = useState(weightToText(weightKg, unit));
  const [error, setError] = useState<string | undefined>();

  const save = () => {
    const result = parseWeightInput(text, unit);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    if (result.kg !== weightKg) {
      onSave(result.kg);
    }
  };

  return (
    <TextField
      label="Weight"
      placeholder="Optional"
      suffix={unit}
      keyboardType="decimal-pad"
      value={text}
      onChangeText={(value) => {
        setText(value);
        setError(undefined);
      }}
      onBlur={save}
      error={error}
      hint="Only used to estimate calories. Stays on this phone."
      maxLength={6}
    />
  );
}

export default function ProfileScreen() {
  const profile = useProfile();
  const update = useProfileStore((state) => state.update);
  const recording = useActiveSession() !== null;

  const [name, setName] = useState(profile.displayName);
  const [permission, setPermission] = useState<Location.LocationPermissionResponse | null>(null);
  const [alerts, setAlerts] = useState<AlertPermission | null>(null);
  const [exactTiming, setExactTiming] = useState<boolean | null>(null);

  // Re-check permissions whenever the tab is shown: they may have changed in system settings.
  useFocusEffect(
    useCallback(() => {
      Location.getForegroundPermissionsAsync().then(setPermission);
      getAlertPermission().then(setAlerts);
      hasExactTiming().then(setExactTiming);
    }, []),
  );

  const reminderDays = parseReminderDays(profile.reminderDays);

  /** Saves the reminder settings and reschedules the notifications to match. */
  const applyReminders = (days: number[], minutes: number) => {
    update({ reminderDays: formatReminderDays(days), reminderMinutes: minutes });
    syncReminders(days, minutes).catch((error: unknown) =>
      console.warn('[reminders] could not schedule', error),
    );
  };

  const handleAlertsPress = async () => {
    if (alerts === 'blocked') {
      await Linking.openSettings();
      return;
    }
    const result = await requestAlertPermission();
    setAlerts(result);
    if (result === 'granted') {
      applyReminders(reminderDays, profile.reminderMinutes);
    }
  };

  const handleDayPress = async (day: number) => {
    const next = toggleDay(reminderDays, day);
    // Adding a day is the moment to ask for notification permission.
    if (next.length > reminderDays.length && alerts === 'undetermined') {
      setAlerts(await requestAlertPermission());
    }
    applyReminders(next, profile.reminderMinutes);
  };

  const handleExactTimingPress = async () => {
    // Opens the system "Alarms & reminders" page for LiveFit.
    setExactTiming(await requestExactTiming());
  };

  const saveName = () => {
    const trimmed = name.trim();
    if (trimmed !== profile.displayName) {
      update({ displayName: trimmed });
    }
  };

  const handleLocationPress = async () => {
    if (permission && !permission.granted && !permission.canAskAgain) {
      // Android/iOS won't show the dialog again; the only way is through settings.
      await Linking.openSettings();
      return;
    }
    setPermission(await Location.requestForegroundPermissionsAsync());
  };

  const restartOnboarding = () => {
    Alert.alert(
      'Restart onboarding?',
      'Your profile is kept; you just go through the setup again.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Restart', onPress: () => update({ onboardedAt: null }) },
      ],
    );
  };

  const initial = profile.displayName.trim().charAt(0).toUpperCase() || '?';

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <AppText variant="headline" style={styles.avatarText}>
            {initial}
          </AppText>
        </View>
        <AppText variant="title">{profile.displayName || 'Your profile'}</AppText>
      </View>

      <Card>
        <TextField
          label="Name"
          placeholder="Your first name"
          value={name}
          onChangeText={setName}
          onBlur={saveName}
          autoCapitalize="words"
          maxLength={40}
        />
        {/* A new key gives the field a fresh start (new initial text) whenever the
            saved weight or the unit changes, e.g. switching kg → lb converts it. */}
        <WeightField
          key={`${profile.weightUnit}:${profile.weightKg}`}
          weightKg={profile.weightKg}
          unit={profile.weightUnit}
          onSave={(weightKg) => update({ weightKg })}
        />
      </Card>

      <Card>
        <AppText variant="label" tone="muted">
          Distance
        </AppText>
        <SegmentedControl
          accessibilityLabel="Distance unit"
          options={[
            { value: 'km', label: 'Kilometres' },
            { value: 'mi', label: 'Miles' },
          ]}
          value={profile.distanceUnit}
          onChange={(distanceUnit) => update({ distanceUnit })}
        />
        <AppText variant="label" tone="muted">
          Weight
        </AppText>
        <SegmentedControl
          accessibilityLabel="Weight unit"
          options={[
            { value: 'kg', label: 'Kilograms' },
            { value: 'lb', label: 'Pounds' },
          ]}
          value={profile.weightUnit}
          onChange={(weightUnit) => update({ weightUnit })}
        />
      </Card>

      <Card>
        <AppText variant="label" tone="muted">
          Weekly goal
        </AppText>
        <Stepper
          accessibilityLabel="Weekly goal"
          value={profile.weeklyGoal}
          min={1}
          max={7}
          format={formatWorkoutCount}
          onChange={(weeklyGoal) => update({ weeklyGoal })}
        />
        <AppText variant="caption" tone="muted">
          Your streak counts the weeks in a row with at least this many workouts.
        </AppText>
      </Card>

      <Card>
        <AppText variant="label" tone="muted">
          Runs and walks
        </AppText>
        <SwitchRow
          title="Auto-pause"
          subtitle="Stops the clock while you're standing still"
          value={profile.autoPause}
          onValueChange={(autoPause) => update({ autoPause })}
        />
        <SwitchRow
          title="Voice cues"
          subtitle={`Spoken time and pace at every ${profile.distanceUnit === 'km' ? 'kilometre' : 'mile'} and lap`}
          value={profile.voiceCues}
          onValueChange={(voiceCues) => update({ voiceCues })}
        />
      </Card>

      <Card>
        <AppText variant="label" tone="muted">
          Workout reminders
        </AppText>
        <View style={styles.days}>
          {WEEKDAYS.map((weekday) => (
            <Chip
              key={weekday.day}
              label={weekday.short}
              accessibilityLabel={weekday.name}
              selected={reminderDays.includes(weekday.day)}
              onPress={() => handleDayPress(weekday.day)}
            />
          ))}
        </View>
        {reminderDays.length > 0 && (
          <Stepper
            accessibilityLabel="Reminder time"
            value={profile.reminderMinutes}
            min={5 * 60}
            max={23 * 60}
            step={15}
            format={formatClock}
            onChange={(minutes) => applyReminders(reminderDays, minutes)}
          />
        )}
        <AppText variant="caption" tone="muted">
          {reminderDays.length > 0
            ? `${describeReminders(reminderDays, profile.reminderMinutes)}.`
            : 'Pick the days you want a nudge to work out.'}
        </AppText>
        {reminderDays.length > 0 && alerts !== null && alerts !== 'granted' && (
          <ListRow
            icon="notifications-off-outline"
            title="Notifications are off"
            subtitle="Reminders can't appear until they're allowed"
            onPress={handleAlertsPress}
          />
        )}
      </Card>

      <Card>
        <AppText variant="label" tone="muted">
          Rest between sets
        </AppText>
        <Stepper
          accessibilityLabel="Rest between sets"
          value={profile.restSeconds}
          min={15}
          max={300}
          step={15}
          format={formatSeconds}
          onChange={(restSeconds) => update({ restSeconds })}
        />
        <ListRow
          icon="notifications-outline"
          title="Rest alerts"
          subtitle="A notification when your rest is over"
          value={alerts ? ALERT_PERMISSION_LABEL[alerts] : undefined}
          onPress={alerts === 'granted' ? undefined : handleAlertsPress}
        />
        {Platform.OS === 'android' && alerts === 'granted' && exactTiming === false && (
          <ListRow
            icon="alarm-outline"
            title="Alert exactly on time"
            subtitle="Allow “Alarms & reminders”, or alerts may come a little late"
            value="Off"
            onPress={handleExactTimingPress}
          />
        )}
      </Card>

      <Card>
        <ListRow
          icon="navigate-outline"
          title="Location"
          subtitle="Used while recording runs and walks"
          value={permission ? describePermission(permission) : undefined}
          onPress={handleLocationPress}
        />
      </Card>

      {__DEV__ && (
        <Card>
          <AppText variant="label" tone="warning">
            Developer
          </AppText>
          <ListRow
            icon="color-palette-outline"
            title="Component gallery"
            onPress={() => router.push('/dev/components')}
          />
          {!recording && (
            <ListRow
              icon="refresh-outline"
              title="Restart onboarding"
              onPress={restartOnboarding}
            />
          )}
          <AppText variant="caption" tone="muted">
            GPS diagnostics for a workout are at the bottom of its detail screen.
          </AppText>
        </Card>
      )}

      <AppText variant="caption" tone="muted" style={styles.version}>
        LiveFit {Constants.expoConfig?.version ?? ''}
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.textOnAccent,
  },
  days: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  version: {
    textAlign: 'center',
  },
});

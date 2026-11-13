import Constants from 'expo-constants';
import * as Location from 'expo-location';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Linking, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { ListRow } from '@/components/ListRow';
import { Screen } from '@/components/Screen';
import { SegmentedControl } from '@/components/SegmentedControl';
import { TextField } from '@/components/TextField';
import { useProfile, useProfileStore } from '@/features/profile/profileStore';
import { parseWeightInput } from '@/features/profile/weight';
import { useRecorderStore } from '@/features/recorder/recorderStore';
import { fromKg, type WeightUnit } from '@/lib/units';
import { colors, radius, spacing } from '@/theme/tokens';

function weightToText(weightKg: number | null, unit: WeightUnit): string {
  return weightKg !== null ? fromKg(weightKg, unit).toFixed(1) : '';
}

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
  const recording = useRecorderStore((state) => state.phase === 'live');

  const [name, setName] = useState(profile.displayName);
  const [permission, setPermission] = useState<Location.LocationPermissionResponse | null>(null);

  // Re-check permission whenever the tab is shown: it may have changed in system settings.
  useFocusEffect(
    useCallback(() => {
      Location.getForegroundPermissionsAsync().then(setPermission);
    }, []),
  );

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
  version: {
    textAlign: 'center',
  },
});

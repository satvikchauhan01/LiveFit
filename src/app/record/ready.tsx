import * as Location from 'expo-location';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Linking, Platform, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { isActivityType } from '@/db/schema';
import { useRecorderStore } from '@/features/recorder/recorderStore';
import { GpsBadge } from '@/features/tracking/GpsBadge';
import { gpsSignalFor, isGoodEnoughToStart } from '@/features/tracking/gpsSignal';
import { type GpsReadiness, useGpsReadiness } from '@/features/tracking/useGpsReadiness';
import { ACTIVITY_DISPLAY } from '@/features/workouts/activities';
import { colors, radius, spacing } from '@/theme/tokens';

const COUNTDOWN_FROM = 3;

export default function ReadyScreen() {
  const params = useLocalSearchParams<{ activity?: string }>();
  const activity = isActivityType(params.activity) ? params.activity : 'run';
  const display = ACTIVITY_DISPLAY[activity];

  const start = useRecorderStore((state) => state.start);
  const { readiness, recheck } = useGpsReadiness();
  const [countdown, setCountdown] = useState<number | null>(null);
  const [starting, setStarting] = useState(false);

  const signal = readiness.state === 'watching' ? gpsSignalFor(readiness.accuracyM) : 'none';
  const canStart = readiness.state === 'watching' && countdown === null && !starting;

  // 3 → 2 → 1 → start. Recording begins when the countdown ends, not when Start is tapped.
  useEffect(() => {
    if (countdown === null) {
      return;
    }
    const timer = setTimeout(() => {
      if (countdown > 1) {
        setCountdown(countdown - 1);
        return;
      }
      setCountdown(null);
      setStarting(true);
      start(activity).then((result) => {
        if (result.ok) {
          router.replace('/recording');
        } else {
          setStarting(false);
          Alert.alert('Couldn’t start', result.reason);
        }
      });
    }, 1000);
    return () => clearTimeout(timer);
  }, [countdown, activity, start]);

  const handleStart = () => {
    if (isGoodEnoughToStart(signal)) {
      setCountdown(COUNTDOWN_FROM);
      return;
    }
    Alert.alert(
      'GPS signal is weak',
      'Distance may be off until the signal improves. Open sky, away from tall buildings, helps.',
      [
        { text: 'Wait', style: 'cancel' },
        { text: 'Start anyway', onPress: () => setCountdown(COUNTDOWN_FROM) },
      ],
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: display.label }} />
      <Screen edges={['bottom']} scroll={false}>
        <View style={styles.hero}>
          <View style={styles.iconCircle}>
            <Icon name={display.icon} size={44} color={colors.accent} />
          </View>
          <AppText variant="headline">{display.label}</AppText>
        </View>

        <GpsStatus readiness={readiness} recheck={recheck} />

        <View style={styles.spacer} />

        <Button
          label={starting ? 'Starting…' : 'Start'}
          onPress={handleStart}
          disabled={!canStart}
        />
      </Screen>

      {countdown !== null && (
        <View style={styles.overlay} accessibilityViewIsModal accessibilityLiveRegion="assertive">
          <AppText variant="label" tone="muted">
            Starting in
          </AppText>
          <AppText variant="display" numeric style={styles.countdown}>
            {countdown}
          </AppText>
          <Button label="Cancel" variant="secondary" onPress={() => setCountdown(null)} />
        </View>
      )}
    </>
  );
}

type GpsStatusProps = {
  readiness: GpsReadiness;
  recheck: () => void;
};

function GpsStatus({ readiness, recheck }: GpsStatusProps) {
  switch (readiness.state) {
    case 'checking':
      return (
        <Card>
          <GpsBadge signal="none" label="Checking location…" />
        </Card>
      );

    case 'services-off':
      return (
        <Card>
          <GpsBadge signal="none" label="Location is off" />
          <AppText tone="muted">Turn on location so LiveFit can record your route.</AppText>
          <Button
            label="Turn on location"
            variant="secondary"
            onPress={async () => {
              try {
                // Android can show its own "turn on location" dialog.
                if (Platform.OS === 'android') {
                  await Location.enableNetworkProviderAsync();
                } else {
                  await Linking.openSettings();
                }
              } catch {
                // The user said no; the status stays as it is.
              }
              recheck();
            }}
          />
        </Card>
      );

    case 'no-permission':
      return (
        <Card>
          <GpsBadge signal="none" label="Location not allowed" />
          <AppText tone="muted">
            LiveFit needs location while you record, to measure distance and pace. It isn’t used at
            any other time.
          </AppText>
          <Button
            label={readiness.canAskAgain ? 'Allow location' : 'Open settings'}
            variant="secondary"
            onPress={async () => {
              if (readiness.canAskAgain) {
                await Location.requestForegroundPermissionsAsync();
                recheck();
              } else {
                await Linking.openSettings();
              }
            }}
          />
        </Card>
      );

    case 'error':
      return (
        <Card>
          <GpsBadge signal="none" label="GPS unavailable" />
          <AppText tone="muted">{readiness.message}</AppText>
          <Button label="Try again" variant="secondary" onPress={recheck} />
        </Card>
      );

    case 'watching': {
      const signal = gpsSignalFor(readiness.accuracyM);
      return (
        <Card>
          <GpsBadge
            signal={signal}
            label={readiness.accuracyM === null ? 'Searching for GPS…' : undefined}
          />
          <AppText tone="muted">
            {readiness.accuracyM === null
              ? 'Hold on while your phone finds you. Outdoors this usually takes a few seconds.'
              : isGoodEnoughToStart(signal)
                ? `Accurate to about ${Math.round(readiness.accuracyM)} m. You’re ready to go.`
                : `Accurate to about ${Math.round(readiness.accuracyM)} m. It should improve in a moment.`}
          </AppText>
        </Card>
      );
    }
  }
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.xl,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spacer: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
  },
  countdown: {
    fontSize: 144,
    lineHeight: 160,
    color: colors.accent,
  },
});

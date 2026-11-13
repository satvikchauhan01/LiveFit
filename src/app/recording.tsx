import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Icon, type IconName } from '@/components/Icon';
import { SegmentedControl } from '@/components/SegmentedControl';
import { StatTile } from '@/components/StatTile';
import { useProfile } from '@/features/profile/profileStore';
import { useRecorderStore } from '@/features/recorder/recorderStore';
import { GpsBadge } from '@/features/tracking/GpsBadge';
import { gpsSignalForLastFix } from '@/features/tracking/gpsSignal';
import { openPause } from '@/features/tracking/pauses';
import { analyzeTrack, currentPaceSecPerKm } from '@/features/tracking/pipeline';
import { computeSplits } from '@/features/tracking/splits';
import { TrackMap } from '@/features/tracking/TrackMap';
import { ACTIVITY_DISPLAY } from '@/features/workouts/activities';
import {
  DISTANCE_UNIT_NAME,
  formatClockTime,
  formatDistanceValue,
  formatDuration,
  formatPaceValue,
} from '@/lib/format';
import { metersPerUnit } from '@/lib/units';
import { useNow } from '@/lib/useNow';
import { colors, minTouchTarget, radius, spacing } from '@/theme/tokens';

type Display = 'stats' | 'map';

function leaveScreen() {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace('/');
  }
}

/** The screen shown while a run or walk is being recorded. */
export default function RecordingScreen() {
  const workout = useRecorderStore((state) => state.workout);
  const points = useRecorderStore((state) => state.points);
  const pauses = useRecorderStore((state) => state.pauses);
  const interrupted = useRecorderStore((state) => state.interrupted);
  const pause = useRecorderStore((state) => state.pause);
  const resume = useRecorderStore((state) => state.resume);
  const finish = useRecorderStore((state) => state.finish);
  const discard = useRecorderStore((state) => state.discard);
  const unit = useProfile().distanceUnit;

  // Redraw once a second while visible. New GPS points also trigger a redraw.
  const now = useNow(1000);
  const [display, setDisplay] = useState<Display>('stats');
  const [busy, setBusy] = useState(false);

  const lastPoint = points[points.length - 1];
  const track = useMemo(() => {
    if (!workout) return null;
    return analyzeTrack({
      activity: workout.type,
      startedAt: workout.startedAt,
      // The GPS clock can run slightly ahead of the phone's clock; never drop the newest fix.
      endAt: Math.max(now, lastPoint?.t ?? 0),
      points,
      pauses,
    });
  }, [workout, points, pauses, now, lastPoint]);

  if (!workout || !track) {
    // Briefly true while leaving after finish or discard.
    return <View style={styles.screen} />;
  }

  const currentPause = openPause(pauses);
  const paused = currentPause !== undefined;
  const signal = gpsSignalForLastFix(lastPoint, now);
  const currentPace = paused ? null : currentPaceSecPerKm(track);
  const split = computeSplits(track, metersPerUnit(unit)).current;
  const unitName = DISTANCE_UNIT_NAME[unit];

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      Alert.alert('Something went wrong', error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const handleResume = () =>
    run(async () => {
      const result = await resume();
      if (!result.ok) {
        Alert.alert('Couldn’t resume', result.reason);
      }
    });

  const handleFinish = () =>
    Alert.alert('Finish workout?', 'It will be saved to your history.', [
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

  const handleDiscard = () =>
    Alert.alert('Discard workout?', 'This recording will be deleted. This can’t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () =>
          run(async () => {
            await discard();
            leaveScreen();
          }),
      },
    ]);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Hide the recording screen. Recording continues."
          hitSlop={12}
          onPress={leaveScreen}
          style={styles.headerButton}
        >
          <Icon name="chevron-down" size={28} />
        </Pressable>
        <AppText variant="title">{ACTIVITY_DISPLAY[workout.type].label}</AppText>
        <GpsBadge signal={signal} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {interrupted && currentPause && (
          <Card style={styles.notice}>
            <AppText>
              LiveFit was closed during your workout, so nothing was recorded after{' '}
              {formatClockTime(currentPause.startedAt)}. Resume to carry on, or finish to save what
              was recorded.
            </AppText>
          </Card>
        )}

        <SegmentedControl
          accessibilityLabel="Show"
          options={[
            { value: 'stats', label: 'Stats' },
            { value: 'map', label: 'Route' },
          ]}
          value={display}
          onChange={setDisplay}
        />

        {display === 'stats' ? (
          <>
            <View style={styles.hero}>
              <AppText variant="label" tone={paused ? 'warning' : 'muted'}>
                {paused ? 'Paused' : 'Time'}
              </AppText>
              <AppText variant="display" numeric>
                {formatDuration(track.movingMs)}
              </AppText>
            </View>
            <View style={styles.hero}>
              <AppText variant="display" numeric>
                {formatDistanceValue(track.distanceM, unit)}
              </AppText>
              <AppText variant="label" tone="muted">
                {unitName.plural}
              </AppText>
            </View>
            <View style={styles.row}>
              <StatTile label={`Pace /${unit}`} value={formatPaceValue(currentPace, unit)} />
              <StatTile
                label={`Avg pace /${unit}`}
                value={formatPaceValue(track.averagePaceSecPerKm, unit)}
              />
            </View>
            <View style={styles.row}>
              <StatTile
                label={`${unitName.singular} ${split.index}`}
                value={formatDuration(split.durationMs)}
              />
              <StatTile label="Elapsed" value={formatDuration(track.elapsedMs)} />
            </View>
          </>
        ) : (
          <>
            <TrackMap track={track} height={320} live />
            <View style={styles.row}>
              <StatTile label="Time" value={formatDuration(track.movingMs)} />
              <StatTile label={unit} value={formatDistanceValue(track.distanceM, unit)} />
              <StatTile label={`Pace /${unit}`} value={formatPaceValue(currentPace, unit)} />
            </View>
          </>
        )}
      </ScrollView>

      <View style={styles.controls}>
        {paused ? (
          <>
            <View style={styles.controlRow}>
              <RoundButton
                icon="play"
                label="Resume"
                variant="accent"
                onPress={handleResume}
                disabled={busy}
              />
              <RoundButton
                icon="flag"
                label="Finish"
                variant="surface"
                onPress={handleFinish}
                disabled={busy}
              />
            </View>
            <Button label="Discard" variant="ghost" onPress={handleDiscard} disabled={busy} />
          </>
        ) : (
          <View style={styles.controlRow}>
            <RoundButton
              icon="pause"
              label="Pause"
              variant="accent"
              onPress={() => run(pause)}
              disabled={busy}
            />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

type RoundButtonProps = {
  icon: IconName;
  label: string;
  variant: 'accent' | 'surface';
  onPress: () => void;
  disabled?: boolean;
};

function RoundButton({ icon, label, variant, onPress, disabled = false }: RoundButtonProps) {
  const accent = variant === 'accent';
  return (
    <View style={styles.roundButtonWrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [
          styles.roundButton,
          accent ? styles.roundAccent : styles.roundSurface,
          pressed && styles.roundPressed,
          disabled && styles.roundDisabled,
        ]}
      >
        <Icon name={icon} size={34} color={accent ? colors.textOnAccent : colors.text} />
      </Pressable>
      <AppText variant="label" tone="muted">
        {label}
      </AppText>
    </View>
  );
}

const ROUND_BUTTON_SIZE = 84;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  headerButton: {
    width: minTouchTarget,
    height: minTouchTarget,
    justifyContent: 'center',
  },
  body: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  notice: {
    borderWidth: 1,
    borderColor: colors.warning,
  },
  hero: {
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  controls: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xxxl,
  },
  roundButtonWrap: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  roundButton: {
    width: ROUND_BUTTON_SIZE,
    height: ROUND_BUTTON_SIZE,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundAccent: {
    backgroundColor: colors.accent,
  },
  roundSurface: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  roundPressed: {
    opacity: 0.75,
  },
  roundDisabled: {
    opacity: 0.4,
  },
});

import * as Sharing from 'expo-sharing';
import { useLocalSearchParams } from 'expo-router';
import { type ComponentRef, useCallback, useMemo, useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { isGpsActivityType } from '@/db/schema';
import { track } from '@/features/analytics/analytics';
import { useProfile } from '@/features/profile/profileStore';
import { sessionTotals } from '@/features/strength/strengthMath';
import { formatVolume } from '@/features/strength/strengthFormat';
import { analyzeTrack } from '@/features/tracking/pipeline';
import { RoutePreview } from '@/features/tracking/RoutePreview';
import { ACTIVITY_DISPLAY } from '@/features/workouts/activities';
import { formatRate } from '@/features/workouts/rateDisplay';
import { loadWorkoutDetail } from '@/features/workouts/workoutRepository';
import { formatDistance, formatDuration, formatWorkoutDate } from '@/lib/format';
import { useQueryOnFocus } from '@/lib/useQueryOnFocus';
import { colors, radius, spacing } from '@/theme/tokens';

/**
 * A picture of the workout (route, headline numbers, LiveFit name) to share
 * anywhere through the phone's share sheet. No account needed: it's just an image.
 */
export default function ShareCardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const profile = useProfile();
  const card = useRef<ComponentRef<typeof View>>(null);
  const [busy, setBusy] = useState(false);
  const detail = useQueryOnFocus(useCallback(() => loadWorkoutDetail(id), [id]));

  const content = useMemo(() => {
    if (!detail) return null;
    const { workout } = detail;
    if (isGpsActivityType(workout.type)) {
      const trackData = analyzeTrack({
        activity: workout.type,
        startedAt: workout.startedAt,
        endAt: workout.endedAt ?? workout.startedAt,
        points: detail.points,
        pauses: detail.pauses,
        autoPause: workout.autoPause,
      });
      return {
        lines: trackData.segments.map((points) => ({
          points,
          color: colors.accent,
          strokeWidth: 5,
        })),
        stats: [
          { label: 'Distance', value: formatDistance(trackData.distanceM, profile.distanceUnit) },
          { label: 'Time', value: formatDuration(trackData.movingMs) },
          {
            label: ACTIVITY_DISPLAY[workout.type].measure === 'pace' ? 'Pace' : 'Speed',
            value: formatRate(
              trackData.averagePaceSecPerKm,
              profile.distanceUnit,
              ACTIVITY_DISPLAY[workout.type].measure,
            ),
          },
        ],
      };
    }
    const totals = sessionTotals(detail.exercises);
    return {
      lines: [],
      stats: [
        { label: 'Time', value: formatDuration((workout.movingS ?? 0) * 1000) },
        { label: 'Volume', value: formatVolume(totals.volumeKg, profile.weightUnit) },
        { label: 'Sets', value: String(totals.sets) },
      ],
    };
  }, [detail, profile.distanceUnit, profile.weightUnit]);

  if (!detail || !content) return <Screen>{null}</Screen>;
  const { workout } = detail;

  const share = async () => {
    setBusy(true);
    try {
      const uri = await captureRef(card, { format: 'png', quality: 1, result: 'tmpfile' });
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share workout' });
      track('share_card', { type: workout.type });
    } catch (error) {
      Alert.alert('Couldn’t share', String(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={['bottom']}>
      {/* collapsable={false} keeps this view real on Android, so it can be captured. */}
      <View ref={card} collapsable={false} style={styles.card}>
        <AppText variant="label" tone="accent">
          {ACTIVITY_DISPLAY[workout.type].label}
        </AppText>
        <AppText variant="headline">
          {workout.title || ACTIVITY_DISPLAY[workout.type].label}
        </AppText>
        <AppText tone="muted">{formatWorkoutDate(workout.startedAt, workout.timezone)}</AppText>
        {content.lines.length > 0 && <RoutePreview lines={content.lines} height={220} />}
        <View style={styles.stats}>
          {content.stats.map((stat) => (
            <View key={stat.label} style={styles.stat}>
              <AppText variant="title" numeric>
                {stat.value}
              </AppText>
              <AppText variant="label" tone="muted">
                {stat.label}
              </AppText>
            </View>
          ))}
        </View>
        <AppText variant="label" tone="accent" style={styles.brand}>
          LiveFit
        </AppText>
      </View>
      <Button label={busy ? 'Preparing…' : 'Share image'} onPress={share} disabled={busy} />
      <AppText variant="caption" tone="muted">
        The picture shows your route’s shape but no map, street names or start time of day.
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    gap: spacing.md,
  },
  stats: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  stat: {
    flex: 1,
    gap: 2,
  },
  brand: {
    alignSelf: 'flex-end',
  },
});

import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ListRow } from '@/components/ListRow';
import { Screen } from '@/components/Screen';
import { GPS_SETTINGS, MAX_SPEED_MPS } from '@/features/tracking/config';
import { shareWorkoutAsGpx } from '@/features/tracking/gpxExport';
import { analyzeTrack } from '@/features/tracking/pipeline';
import { RoutePreview } from '@/features/tracking/RoutePreview';
import { loadWorkoutDetail, type WorkoutDetail } from '@/features/workouts/workoutRepository';
import { formatBatteryDrain, formatDistance, formatDuration, formatMeters } from '@/lib/format';
import { colors, spacing } from '@/theme/tokens';

/**
 * Dev-only look inside the GPS pipeline for one workout: what was dropped and
 * why, how much smoothing changed the distance, gaps, and battery use.
 * This is how the FR-02 "done when" checks are measured.
 */
export default function WorkoutDiagnosticsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [detail, setDetail] = useState<WorkoutDetail | null | undefined>(undefined);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadWorkoutDetail(id)
      .then((loaded) => {
        if (!cancelled) setDetail(loaded);
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
  }, [id]);

  // A workout that's still being recorded has no end yet: use the last fix.
  const endAt = detail
    ? (detail.workout.endedAt ??
      detail.points[detail.points.length - 1]?.t ??
      detail.workout.startedAt)
    : 0;

  const track = useMemo(() => {
    if (!detail) return null;
    const { workout, points, pauses } = detail;
    return analyzeTrack({
      activity: workout.type,
      startedAt: workout.startedAt,
      endAt,
      points,
      pauses,
    });
  }, [detail, endAt]);

  if (detail === undefined) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  if (!detail || !track) {
    return (
      <View style={styles.centered}>
        <AppText tone="muted">This workout no longer exists.</AppText>
      </View>
    );
  }

  const { workout, points, pauses } = detail;
  const { diagnostics } = track;
  const elapsedMs = endAt - workout.startedAt;

  const handleExport = async () => {
    setExporting(true);
    try {
      await shareWorkoutAsGpx(workout, points, pauses);
    } catch (error) {
      Alert.alert('Export failed', error instanceof Error ? error.message : String(error));
    } finally {
      setExporting(false);
    }
  };

  return (
    <Screen edges={['bottom']}>
      <RoutePreview
        lines={[
          { points, color: colors.textMuted, strokeWidth: 1.5 },
          ...track.segments.map((segment) => ({
            points: segment,
            color: colors.accent,
            strokeWidth: 3,
          })),
        ]}
      />
      <AppText variant="caption" tone="muted">
        Grey: every raw GPS fix. Lime: the route LiveFit measures (filtered and smoothed, split at
        pauses).
      </AppText>

      <Card>
        <AppText variant="label" tone="muted">
          Distance
        </AppText>
        <ListRow title="Measured (final)" value={formatDistance(track.distanceM)} />
        <ListRow title="Before smoothing" value={formatDistance(diagnostics.unsmoothedDistanceM)} />
        <ListRow title="Raw, every point" value={formatDistance(diagnostics.rawDistanceM)} />
      </Card>

      <Card>
        <AppText variant="label" tone="muted">
          Points
        </AppText>
        <ListRow title="Recorded" value={String(diagnostics.pointCount)} />
        <ListRow title="Kept" value={String(diagnostics.keptCount)} />
        <ListRow
          title="Dropped: inaccurate"
          subtitle={`Accuracy worse than ${GPS_SETTINGS.maxAccuracyM} m`}
          value={String(diagnostics.dropped.inaccurate)}
        />
        <ListRow
          title="Dropped: too fast"
          subtitle={`Faster than ${MAX_SPEED_MPS[workout.type]} m/s`}
          value={String(diagnostics.dropped.tooFast)}
        />
        <ListRow title="Dropped: while paused" value={String(diagnostics.dropped.paused)} />
        <ListRow title="Dropped: out of order" value={String(diagnostics.dropped.outOfOrder)} />
        <ListRow
          title="Dropped: before start / after end"
          value={String(diagnostics.dropped.outsideWorkout)}
        />
        <ListRow title="Mocked (fake GPS)" value={String(diagnostics.mockedCount)} />
      </Card>

      <Card>
        <AppText variant="label" tone="muted">
          Recording health
        </AppText>
        <ListRow
          title="Longest gap between fixes"
          subtitle="Long gaps mean the phone suspended recording"
          value={formatDuration(diagnostics.longestGapMs)}
        />
        <ListRow title="Average accuracy" value={formatMeters(diagnostics.averageAccuracyM)} />
        <ListRow title="Pauses" value={String(pauses.length)} />
        <ListRow
          title="Battery use"
          subtitle="Needs at least 5 minutes of recording"
          value={formatBatteryDrain(workout.batteryStart, workout.batteryEnd, elapsedMs)}
        />
      </Card>

      <Button
        label={exporting ? 'Exporting…' : 'Export GPX'}
        onPress={handleExport}
        disabled={exporting || points.length === 0}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    backgroundColor: colors.background,
  },
});

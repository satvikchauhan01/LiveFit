import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { StatTile } from '@/components/StatTile';
import { analyzeTrack } from '@/features/tracking/pipeline';
import { computeSplits, splitsForSummary } from '@/features/tracking/splits';
import { TrackMap } from '@/features/tracking/TrackMap';
import { formatDistance, formatDuration, formatPace } from '@/lib/format';
import { type DistanceUnit, metersPerUnit } from '@/lib/units';
import { spacing } from '@/theme/tokens';

import { SplitsTable } from './SplitsTable';
import type { WorkoutDetail } from './workoutRepository';

type Props = {
  detail: WorkoutDetail;
  unit: DistanceUnit;
};

/** Route, headline numbers and splits of a finished workout. */
export function WorkoutSummary({ detail, unit }: Props) {
  const { workout, points, pauses } = detail;

  const track = useMemo(
    () =>
      analyzeTrack({
        activity: workout.type,
        startedAt: workout.startedAt,
        endAt: workout.endedAt ?? workout.startedAt,
        points,
        pauses,
      }),
    [workout.type, workout.startedAt, workout.endedAt, points, pauses],
  );
  const splits = useMemo(
    () => splitsForSummary(computeSplits(track, metersPerUnit(unit))),
    [track, unit],
  );

  return (
    <>
      <TrackMap track={track} height={240} />

      <View style={styles.grid}>
        <View style={styles.row}>
          <StatTile label="Distance" value={formatDistance(track.distanceM, unit)} />
          <StatTile label="Moving time" value={formatDuration(track.movingMs)} />
        </View>
        <View style={styles.row}>
          <StatTile label="Avg pace" value={formatPace(track.averagePaceSecPerKm, unit)} />
          <StatTile label="Elapsed time" value={formatDuration(track.elapsedMs)} />
        </View>
      </View>

      <Card>
        <AppText variant="label" tone="muted">
          Splits
        </AppText>
        <SplitsTable splits={splits} unit={unit} />
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  grid: {
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
});

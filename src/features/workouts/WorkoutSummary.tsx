import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { StatTile } from '@/components/StatTile';
import type { GpsActivityType } from '@/db/schema';
import { analyzeTrack } from '@/features/tracking/pipeline';
import { computeLaps, computeSplits, splitsForSummary } from '@/features/tracking/splits';
import { TrackMap } from '@/features/tracking/TrackMap';
import { formatDistance, formatDuration, formatPace } from '@/lib/format';
import { type DistanceUnit, metersPerUnit } from '@/lib/units';
import { spacing } from '@/theme/tokens';

import { LapsTable } from './LapsTable';
import { SplitsTable } from './SplitsTable';
import type { WorkoutDetail } from './workoutRepository';

type Props = {
  detail: WorkoutDetail;
  /** Passed separately because only runs and walks have a route. */
  activity: GpsActivityType;
  unit: DistanceUnit;
};

/** Route, headline numbers and splits of a finished workout. */
export function WorkoutSummary({ detail, activity, unit }: Props) {
  const { workout, points, pauses, laps } = detail;

  const track = useMemo(
    () =>
      analyzeTrack({
        activity,
        startedAt: workout.startedAt,
        endAt: workout.endedAt ?? workout.startedAt,
        points,
        pauses,
        autoPause: workout.autoPause,
      }),
    [activity, workout.startedAt, workout.endedAt, workout.autoPause, points, pauses],
  );
  const splits = useMemo(
    () => splitsForSummary(computeSplits(track, metersPerUnit(unit))),
    [track, unit],
  );
  const lapSplits = useMemo(
    () =>
      computeLaps(
        track,
        laps.map((lap) => lap.t),
      ),
    [track, laps],
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

      {lapSplits.length > 0 && (
        <Card>
          <AppText variant="label" tone="muted">
            Laps
          </AppText>
          <LapsTable laps={lapSplits} unit={unit} />
        </Card>
      )}
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

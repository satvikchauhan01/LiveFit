import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { StatTile } from '@/components/StatTile';
import type { GpsActivityType } from '@/db/schema';
import { analyzeTrack } from '@/features/tracking/pipeline';
import { computeLaps, computeSplits, splitsForSummary } from '@/features/tracking/splits';
import { TrackMap } from '@/features/tracking/TrackMap';
import { formatDistance, formatDuration } from '@/lib/format';
import { type DistanceUnit, metersPerUnit } from '@/lib/units';
import { spacing } from '@/theme/tokens';

import { ACTIVITY_DISPLAY } from './activities';
import { LapsTable } from './LapsTable';
import { formatRate } from './rateDisplay';
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
  const measure = ACTIVITY_DISPLAY[activity].measure;

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
          <StatTile
            label={measure === 'pace' ? 'Avg pace' : 'Avg speed'}
            value={formatRate(track.averagePaceSecPerKm, unit, measure)}
          />
          <StatTile label="Elapsed time" value={formatDuration(track.elapsedMs)} />
        </View>
        <View style={styles.row}>
          <StatTile
            label="Climb"
            value={
              unit === 'km'
                ? `${Math.round(track.elevationGainM)} m`
                : `${Math.round(track.elevationGainM * 3.28084)} ft`
            }
          />
          <StatTile
            label="Calories (est.)"
            value={workout.caloriesEst !== null ? `${Math.round(workout.caloriesEst)} kcal` : '–'}
          />
        </View>
      </View>

      <Card>
        <AppText variant="label" tone="muted">
          Splits
        </AppText>
        <SplitsTable splits={splits} unit={unit} measure={measure} />
      </Card>

      {lapSplits.length > 0 && (
        <Card>
          <AppText variant="label" tone="muted">
            Laps
          </AppText>
          <LapsTable laps={lapSplits} unit={unit} measure={measure} />
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

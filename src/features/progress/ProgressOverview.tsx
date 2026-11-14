import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { type Bar, BarChart } from '@/components/BarChart';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { LineChart } from '@/components/LineChart';
import { ListRow } from '@/components/ListRow';
import { StatTile } from '@/components/StatTile';
import { MUSCLE_GROUP_LABEL } from '@/features/strength/builtInExercises';
import { formatVolume } from '@/features/strength/strengthFormat';
import { useProfile } from '@/features/profile/profileStore';
import { useWorkoutList } from '@/features/workouts/useWorkouts';
import { addUp, weekOf } from '@/features/workouts/weeks';
import type { WorkoutFilter, WorkoutListItem } from '@/features/workouts/workoutRepository';
import {
  addDays,
  currentWeekKey,
  localDateTime,
  localNow,
  MONTH_SHORT,
  parseDateKey,
} from '@/lib/dates';
import { formatDistance, formatDistanceValue, formatDuration, formatPace } from '@/lib/format';
import { useQueryOnFocus } from '@/lib/useQueryOnFocus';
import { colors, radius, spacing } from '@/theme/tokens';

import { muscleVolumeSince } from './progressRepository';

const ALL: WorkoutFilter = {};
const WEEKS_SHOWN = 12;

type Metric = 'distance' | 'time' | 'workouts';

function weekBars(workouts: WorkoutListItem[], metric: Metric): Bar[] {
  const thisWeek = currentWeekKey();
  const keys = Array.from({ length: WEEKS_SHOWN }, (_, i) =>
    addDays(thisWeek, -7 * (WEEKS_SHOWN - 1 - i)),
  );
  const totals = new Map(keys.map((key) => [key, 0]));
  for (const workout of workouts) {
    const key = weekOf(workout);
    if (!totals.has(key)) continue;
    const add =
      metric === 'distance'
        ? (workout.distanceM ?? 0) / 1000
        : metric === 'time'
          ? (workout.movingS ?? 0) / 3600
          : 1;
    totals.set(key, (totals.get(key) ?? 0) + add);
  }
  return keys.map((key) => {
    const { day, month } = parseDateKey(key);
    return {
      label: `${day} ${MONTH_SHORT[month - 1]}`,
      value: totals.get(key) ?? 0,
      highlight: key === thisWeek,
    };
  });
}

/** The Progress tab's overview: weekly chart, this month, hybrid balance and trends. */
export function ProgressOverview() {
  const profile = useProfile();
  const workouts = useWorkoutList(ALL);
  const [metric, setMetric] = useState<Metric>('distance');

  const muscles = useQueryOnFocus(
    useCallback(() => muscleVolumeSince(Date.now() - 28 * 24 * 60 * 60 * 1000), []),
  );

  const stats = useMemo(() => {
    if (!workouts) return null;
    const now = localNow();
    const thisMonth = workouts.filter((workout) => {
      const local = localDateTime(workout.startedAt, workout.timezone);
      return local.year === now.year && local.month === now.month;
    });
    const thisWeek = workouts.filter((workout) => weekOf(workout) === currentWeekKey());
    const cardioWeek = thisWeek.filter((workout) => workout.type !== 'strength');
    const strengthWeek = thisWeek.filter((workout) => workout.type === 'strength');
    const runs = workouts
      .filter((workout) => workout.type === 'run' && workout.distanceM && workout.movingS)
      .slice(0, 15)
      .reverse();
    return {
      month: addUp(thisMonth),
      monthVolume: thisMonth.reduce((sum, workout) => sum + (workout.volumeKg ?? 0), 0),
      monthStrength: thisMonth.filter((workout) => workout.type === 'strength').length,
      cardio: addUp(cardioWeek),
      strength: addUp(strengthWeek),
      runPaces: runs.map((run) => (run.movingS ?? 0) / ((run.distanceM ?? 1) / 1000)),
    };
  }, [workouts]);

  if (!workouts || !stats) return null;

  const unit = profile.distanceUnit;
  const metricFormat = (value: number) =>
    metric === 'distance'
      ? `${formatDistanceValue(value * 1000, unit)} ${unit}`
      : metric === 'time'
        ? formatDuration(value * 3_600_000)
        : `${Math.round(value)}`;
  const weekTotalSeconds = stats.cardio.movingS + stats.strength.movingS;
  const cardioShare = weekTotalSeconds > 0 ? stats.cardio.movingS / weekTotalSeconds : 0.5;
  const maxMuscle = Math.max(1, ...(muscles ?? []).map((item) => item.volumeKg));

  return (
    <>
      <Card>
        <ListRow icon="flag-outline" title="Goals" onPress={() => router.push('/goals')} />
        <ListRow
          icon="calendar-outline"
          title="Training plans"
          onPress={() => router.push('/plans')}
        />
        <ListRow
          icon="list-outline"
          title="Strength routines"
          onPress={() => router.push('/routines')}
        />
      </Card>

      <Card>
        <AppText variant="label" tone="muted">
          Last {WEEKS_SHOWN} weeks
        </AppText>
        <View style={styles.chips}>
          {(
            [
              ['distance', 'Distance'],
              ['time', 'Time'],
              ['workouts', 'Workouts'],
            ] as const
          ).map(([value, label]) => (
            <Chip
              key={value}
              label={label}
              selected={metric === value}
              onPress={() => setMetric(value)}
            />
          ))}
        </View>
        <BarChart
          bars={weekBars(workouts, metric)}
          accessibilityLabel={`${metric} per week`}
          formatValue={metricFormat}
        />
      </Card>

      <View style={styles.section}>
        <AppText variant="label" tone="muted">
          This month
        </AppText>
        <View style={styles.row}>
          <StatTile label="Workouts" value={String(stats.month.count)} />
          <StatTile label="Time" value={formatDuration(stats.month.movingS * 1000)} />
        </View>
        <View style={styles.row}>
          <StatTile label="Distance" value={formatDistance(stats.month.distanceM, unit)} />
          <StatTile label="Volume" value={formatVolume(stats.monthVolume, profile.weightUnit)} />
        </View>
      </View>

      <Card>
        <AppText variant="label" tone="muted">
          Hybrid balance this week
        </AppText>
        <View
          style={styles.balanceTrack}
          accessible
          accessibilityLabel={`Cardio ${Math.round(cardioShare * 100)} percent, strength ${Math.round((1 - cardioShare) * 100)} percent of training time`}
        >
          <View style={[styles.balanceCardio, { flex: Math.max(0.001, cardioShare) }]} />
          <View style={[styles.balanceStrength, { flex: Math.max(0.001, 1 - cardioShare) }]} />
        </View>
        <View style={styles.row}>
          <AppText style={styles.flex}>
            Cardio: {stats.cardio.count} · {formatDuration(stats.cardio.movingS * 1000)}
          </AppText>
          <AppText style={styles.flex}>
            Strength: {stats.strength.count} · {formatDuration(stats.strength.movingS * 1000)}
          </AppText>
        </View>
      </Card>

      {stats.runPaces.length >= 2 && (
        <Card>
          <AppText variant="label" tone="muted">
            Run pace, last {stats.runPaces.length} runs
          </AppText>
          <LineChart
            values={stats.runPaces}
            invert
            accessibilityLabel={`Run pace trend. Latest ${formatPace(stats.runPaces[stats.runPaces.length - 1], unit)}`}
          />
          <AppText tone="muted">
            Latest: {formatPace(stats.runPaces[stats.runPaces.length - 1], unit)}. Higher on the
            chart is faster.
          </AppText>
        </Card>
      )}

      {muscles && muscles.length > 0 && (
        <Card>
          <AppText variant="label" tone="muted">
            Volume by muscle group, last 4 weeks
          </AppText>
          {muscles
            .slice()
            .sort((a, b) => b.volumeKg - a.volumeKg)
            .map((item) => (
              <View key={item.muscleGroup} style={styles.muscleRow}>
                <AppText style={styles.muscleName}>{MUSCLE_GROUP_LABEL[item.muscleGroup]}</AppText>
                <View style={styles.muscleTrack}>
                  <View
                    style={[styles.muscleBar, { width: `${(item.volumeKg / maxMuscle) * 100}%` }]}
                  />
                </View>
                <AppText tone="muted" numeric>
                  {formatVolume(item.volumeKg, profile.weightUnit)}
                </AppText>
              </View>
            ))}
        </Card>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  flex: {
    flex: 1,
  },
  chips: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  balanceTrack: {
    flexDirection: 'row',
    height: 12,
    borderRadius: radius.pill,
    overflow: 'hidden',
    gap: 2,
  },
  balanceCardio: {
    backgroundColor: colors.accent,
  },
  balanceStrength: {
    backgroundColor: colors.success,
  },
  muscleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  muscleName: {
    width: 84,
  },
  muscleTrack: {
    flex: 1,
    height: 10,
  },
  muscleBar: {
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
});

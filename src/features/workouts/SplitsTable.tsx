import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import type { Split } from '@/features/tracking/splits';
import type { Measure } from '@/features/workouts/activities';
import { rateUnit, rateValue } from '@/features/workouts/rateDisplay';
import { DISTANCE_UNIT_NAME, formatDistanceValue } from '@/lib/format';
import type { DistanceUnit } from '@/lib/units';
import { colors, radius, spacing } from '@/theme/tokens';

type Props = {
  splits: Split[];
  unit: DistanceUnit;
  measure?: Measure;
};

/** One row per km (or mile), with a bar that's longer for faster splits. */
export function SplitsTable({ splits, unit, measure = 'pace' }: Props) {
  if (splits.length === 0) {
    return (
      <AppText tone="muted">
        Splits appear once you’ve covered your first {unit === 'km' ? 'kilometre' : 'mile'}.
      </AppText>
    );
  }

  const paces = splits.map((split) => split.paceSecPerKm ?? Infinity);
  const fastest = Math.min(...paces);

  return (
    <View style={styles.table}>
      <View style={styles.row}>
        <AppText variant="label" tone="muted" style={styles.indexColumn}>
          {DISTANCE_UNIT_NAME[unit].singular}
        </AppText>
        <AppText variant="label" tone="muted" style={styles.paceColumn}>
          {measure === 'pace' ? 'Pace' : rateUnit(unit, measure)}
        </AppText>
      </View>
      {splits.map((split) => {
        const pace = split.paceSecPerKm;
        // Bar length is relative speed: the fastest split fills the row.
        const share = pace !== null && Number.isFinite(fastest) ? fastest / pace : 0;
        const label = split.partial
          ? formatDistanceValue(split.distanceM, unit)
          : String(split.index);
        return (
          <View
            key={split.index}
            style={styles.row}
            accessible
            accessibilityLabel={`${DISTANCE_UNIT_NAME[unit].singular} ${label}: ${rateValue(pace, unit, measure)} ${rateUnit(unit, measure)}`}
          >
            <AppText numeric style={styles.indexColumn}>
              {label}
            </AppText>
            <AppText numeric style={styles.paceColumn}>
              {rateValue(pace, unit, measure)}
            </AppText>
            <View style={styles.barTrack}>
              <View style={[styles.bar, { width: `${Math.max(8, share * 100)}%` }]} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  table: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  indexColumn: {
    width: 48,
  },
  paceColumn: {
    width: 56,
  },
  barTrack: {
    flex: 1,
    height: 10,
  },
  bar: {
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
});

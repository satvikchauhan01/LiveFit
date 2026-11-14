import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import type { Split } from '@/features/tracking/splits';
import { formatDistanceValue, formatDuration, formatPaceValue } from '@/lib/format';
import type { DistanceUnit } from '@/lib/units';
import { spacing } from '@/theme/tokens';

type Props = {
  laps: Split[];
  unit: DistanceUnit;
};

/** Manual laps: distance, time and pace of each. */
export function LapsTable({ laps, unit }: Props) {
  return (
    <View style={styles.table}>
      <View style={styles.row} importantForAccessibility="no-hide-descendants">
        {['Lap', unit, 'Time', 'Pace'].map((title) => (
          <AppText key={title} variant="label" tone="muted" style={styles.cell}>
            {title}
          </AppText>
        ))}
      </View>
      {laps.map((lap) => (
        <View
          key={lap.index}
          style={styles.row}
          accessible
          accessibilityLabel={`Lap ${lap.index}: ${formatDistanceValue(lap.distanceM, unit)} ${unit} in ${formatDuration(lap.durationMs)}`}
        >
          <AppText numeric style={styles.cell}>
            {lap.index}
          </AppText>
          <AppText numeric style={styles.cell}>
            {formatDistanceValue(lap.distanceM, unit)}
          </AppText>
          <AppText numeric style={styles.cell}>
            {formatDuration(lap.durationMs)}
          </AppText>
          <AppText numeric style={styles.cell}>
            {formatPaceValue(lap.paceSecPerKm, unit)}
          </AppText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  table: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  cell: {
    flex: 1,
  },
});

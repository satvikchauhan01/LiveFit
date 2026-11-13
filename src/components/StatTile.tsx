import { StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '@/theme/tokens';

import { AppText } from './AppText';

type Props = {
  label: string;
  value: string;
  size?: 'regular' | 'large';
};

export function StatTile({ label, value, size = 'regular' }: Props) {
  return (
    <View style={styles.tile} accessible accessibilityLabel={`${label}: ${value}`}>
      <AppText variant={size === 'large' ? 'display' : 'title'} numeric>
        {value}
      </AppText>
      <AppText variant="label" tone="muted">
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.xs,
  },
});

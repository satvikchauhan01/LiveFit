import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { colors, radius, spacing } from '@/theme/tokens';

import type { GpsSignal } from './gpsSignal';

const SIGNAL_STYLE: Record<GpsSignal, { label: string; color: string }> = {
  none: { label: 'No GPS', color: colors.danger },
  weak: { label: 'Weak GPS', color: colors.warning },
  good: { label: 'Good GPS', color: colors.success },
  strong: { label: 'Strong GPS', color: colors.success },
};

type Props = {
  signal: GpsSignal;
  /** Replaces the default wording, e.g. "Searching for GPS…" before a fix. */
  label?: string;
};

export function GpsBadge({ signal, label }: Props) {
  const style = SIGNAL_STYLE[signal];
  const text = label ?? style.label;
  return (
    <View style={styles.badge} accessible accessibilityLabel={`GPS signal: ${text}`}>
      <View style={[styles.dot, { backgroundColor: style.color }]} />
      <AppText variant="caption">{text}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: radius.pill,
  },
});

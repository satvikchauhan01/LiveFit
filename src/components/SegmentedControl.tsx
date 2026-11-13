import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, minTouchTarget, radius, spacing } from '@/theme/tokens';

type Option<T extends string> = {
  value: T;
  label: string;
};

type Props<T extends string> = {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel?: string;
};

/**
 * A row of mutually exclusive choices, e.g. km / mi.
 * Generic over T so `value` and `onChange` stay type-safe: passing 'miles'
 * where only 'km' | 'mi' is allowed is a compile error.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: Props<T>) {
  return (
    <View
      style={styles.track}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[styles.segment, selected && styles.segmentSelected]}
          >
            <Text style={[styles.label, selected && styles.labelSelected]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.pill,
    padding: spacing.xs,
    gap: spacing.xs,
  },
  segment: {
    flex: 1,
    minHeight: minTouchTarget - spacing.sm,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentSelected: {
    backgroundColor: colors.accent,
  },
  label: {
    color: colors.textMuted,
    fontSize: fontSize.body,
    fontWeight: '600',
  },
  labelSelected: {
    color: colors.textOnAccent,
    fontWeight: '700',
  },
});

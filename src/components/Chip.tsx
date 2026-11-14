import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, fontSize, minTouchTarget, radius, spacing } from '@/theme/tokens';

type Props = {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** Read out instead of the label, e.g. "Monday" for "Mo". */
  accessibilityLabel?: string;
};

const HEIGHT = 36;

/** A small toggle, used in rows of filters. */
export function Chip({ label, selected, onPress, accessibilityLabel }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
      onPress={onPress}
      // The chip looks small, but the tap area still reaches the 48 dp minimum.
      hitSlop={{ top: (minTouchTarget - HEIGHT) / 2, bottom: (minTouchTarget - HEIGHT) / 2 }}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.selected,
        pressed && !selected && styles.pressed,
      ]}
    >
      <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    height: HEIGHT,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  pressed: {
    backgroundColor: colors.surfaceRaised,
  },
  label: {
    color: colors.text,
    fontSize: fontSize.body,
    fontWeight: '600',
  },
  labelSelected: {
    color: colors.textOnAccent,
  },
});

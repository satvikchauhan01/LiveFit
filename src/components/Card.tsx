import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { colors, radius, spacing } from '@/theme/tokens';

type Props = {
  children: ReactNode;
  /** Makes the whole card tappable. */
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: ViewStyle;
};

export function Card({ children, onPress, accessibilityLabel, style }: Props) {
  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        style={({ pressed }) => [styles.card, pressed && styles.pressed, style]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  pressed: {
    backgroundColor: colors.surfaceRaised,
  },
});

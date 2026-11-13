import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, fontSize, minTouchTarget, radius, spacing } from '@/theme/tokens';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
};

export function Button({ label, onPress, variant = 'primary', disabled = false }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        variantStyles[variant],
        pressed && (variant === 'primary' ? styles.primaryPressed : styles.pressed),
        disabled && styles.disabled,
      ]}
    >
      <Text
        style={[
          styles.label,
          variant === 'primary' && styles.labelOnAccent,
          variant === 'ghost' && styles.labelGhost,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: minTouchTarget,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryPressed: {
    backgroundColor: colors.accentPressed,
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.4,
  },
  label: {
    color: colors.text,
    fontSize: fontSize.body,
    fontWeight: '700',
  },
  labelOnAccent: {
    color: colors.textOnAccent,
  },
  labelGhost: {
    color: colors.textMuted,
  },
});

const variantStyles = StyleSheet.create({
  primary: {
    backgroundColor: colors.accent,
  },
  secondary: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  danger: {
    backgroundColor: colors.danger,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
});

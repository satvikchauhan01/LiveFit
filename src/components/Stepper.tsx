import { Pressable, StyleSheet, View } from 'react-native';

import { colors, minTouchTarget, radius, spacing } from '@/theme/tokens';

import { AppText } from './AppText';
import { Icon } from './Icon';

type Props = {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  /** What the number means, read out by screen readers, e.g. "Weekly goal". */
  accessibilityLabel: string;
  /** How the value is shown, e.g. 3 → "3 workouts". */
  format?: (value: number) => string;
  /** How much one tap changes the value. Defaults to 1. */
  step?: number;
};

/** − value + control for small numbers, e.g. a weekly goal or a rest time. */
export function Stepper({
  value,
  min,
  max,
  onChange,
  accessibilityLabel,
  format = String,
  step = 1,
}: Props) {
  const decrease = () => onChange(Math.max(min, value - step));
  const increase = () => onChange(Math.min(max, value + step));

  return (
    <View
      style={styles.row}
      // "Adjustable" lets screen-reader users swipe up/down to change the value.
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min, max, now: value, text: format(value) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'increment') increase();
        if (event.nativeEvent.actionName === 'decrement') decrease();
      }}
    >
      <StepButton icon="remove" onPress={decrease} disabled={value <= min} />
      <AppText variant="title" numeric style={styles.value}>
        {format(value)}
      </AppText>
      <StepButton icon="add" onPress={increase} disabled={value >= max} />
    </View>
  );
}

function StepButton({
  icon,
  onPress,
  disabled,
}: {
  icon: 'add' | 'remove';
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      importantForAccessibility="no"
      style={({ pressed }) => [
        styles.button,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Icon name={icon} size={24} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  value: {
    flex: 1,
    textAlign: 'center',
  },
  button: {
    width: minTouchTarget,
    height: minTouchTarget,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.3,
  },
});

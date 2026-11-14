import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { formatDuration } from '@/lib/format';
import { useNow } from '@/lib/useNow';
import { colors, fontSize, minTouchTarget, radius, spacing } from '@/theme/tokens';

import { useStrengthStore } from './strengthStore';

/** The countdown after a set. The scheduled notification covers the screen-off case. */
export function RestTimerBar() {
  const rest = useStrengthStore((state) => state.rest);
  const adjustRest = useStrengthStore((state) => state.adjustRest);
  const skipRest = useStrengthStore((state) => state.skipRest);
  const now = useNow(1000);

  if (!rest) {
    return null;
  }

  const remainingMs = Math.max(0, rest.endsAt - now);
  const over = remainingMs === 0;
  // Count down in whole seconds, rounding up, so it shows 0:00 only when time's up.
  const shown = formatDuration(Math.ceil(remainingMs / 1000) * 1000);

  return (
    <View style={[styles.bar, over && styles.barOver]} accessibilityLiveRegion="polite">
      <View style={styles.time}>
        <AppText variant="label" tone={over ? 'accent' : 'muted'}>
          {over ? 'Rest over' : 'Rest'}
        </AppText>
        <AppText variant="headline" numeric>
          {shown}
        </AppText>
      </View>
      {!over && (
        <>
          <SmallButton
            label="−15"
            accessibilityLabel="15 seconds less"
            onPress={() => adjustRest(-15)}
          />
          <SmallButton
            label="+30"
            accessibilityLabel="30 seconds more"
            onPress={() => adjustRest(30)}
          />
        </>
      )}
      <SmallButton
        label={over ? 'Done' : 'Skip'}
        accessibilityLabel={over ? 'Close rest timer' : 'Skip rest'}
        onPress={skipRest}
        primary={over}
      />
    </View>
  );
}

function SmallButton({
  label,
  accessibilityLabel,
  onPress,
  primary = false,
}: {
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        primary && styles.buttonPrimary,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.buttonLabel, primary && styles.buttonLabelPrimary]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  barOver: {
    borderTopColor: colors.accent,
  },
  time: {
    flex: 1,
  },
  button: {
    minWidth: minTouchTarget + spacing.md,
    height: minTouchTarget,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimary: {
    backgroundColor: colors.accent,
  },
  buttonLabel: {
    color: colors.text,
    fontSize: fontSize.body,
    fontWeight: '700',
  },
  buttonLabelPrimary: {
    color: colors.textOnAccent,
  },
  pressed: {
    opacity: 0.7,
  },
});

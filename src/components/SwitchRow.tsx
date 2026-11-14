import { StyleSheet, Switch, View } from 'react-native';

import { colors, minTouchTarget, spacing } from '@/theme/tokens';

import { AppText } from './AppText';

type Props = {
  title: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
};

/** A setting that is on or off. The whole row is one control for screen readers. */
export function SwitchRow({ title, subtitle, value, onValueChange }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.text} importantForAccessibility="no-hide-descendants">
        <AppText>{title}</AppText>
        {subtitle && (
          <AppText variant="caption" tone="muted">
            {subtitle}
          </AppText>
        )}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
        trackColor={{ false: colors.surfaceRaised, true: colors.accentPressed }}
        thumbColor={value ? colors.accent : colors.textMuted}
        ios_backgroundColor={colors.surfaceRaised}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: minTouchTarget + spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  text: {
    flex: 1,
    gap: 2,
  },
});

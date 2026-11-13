import { Pressable, StyleSheet, View } from 'react-native';

import { colors, minTouchTarget, spacing } from '@/theme/tokens';

import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

type Props = {
  title: string;
  subtitle?: string;
  /** Short value shown on the right, e.g. "km" or "Allowed". */
  value?: string;
  icon?: IconName;
  onPress?: () => void;
};

export function ListRow({ title, subtitle, value, icon, onPress }: Props) {
  const content = (
    <>
      {icon && <Icon name={icon} color={colors.textMuted} />}
      <View style={styles.text}>
        <AppText>{title}</AppText>
        {subtitle && (
          <AppText variant="caption" tone="muted">
            {subtitle}
          </AppText>
        )}
      </View>
      {value && <AppText tone="muted">{value}</AppText>}
      {onPress && <Icon name="chevron-forward" size={18} color={colors.textMuted} />}
    </>
  );

  if (!onPress) {
    return <View style={styles.row}>{content}</View>;
  }
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: minTouchTarget + spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  pressed: {
    opacity: 0.6,
  },
  text: {
    flex: 1,
    gap: 2,
  },
});

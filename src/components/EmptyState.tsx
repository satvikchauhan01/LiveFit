import { StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '@/theme/tokens';

import { AppText } from './AppText';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';

type Props = {
  icon: IconName;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

/** Shown when a list has nothing in it yet, with a nudge towards the next step. */
export function EmptyState({ icon, title, message, actionLabel, onAction }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Icon name={icon} size={28} color={colors.accent} />
      </View>
      <AppText variant="title" style={styles.centered}>
        {title}
      </AppText>
      <AppText tone="muted" style={styles.centered}>
        {message}
      </AppText>
      {actionLabel && onAction && <Button label={actionLabel} onPress={onAction} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centered: {
    textAlign: 'center',
  },
});

import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { colors, spacing } from '@/theme/tokens';

import type { Remote } from './useRemote';

type Props = {
  remote: Pick<Remote<unknown>, 'data' | 'error' | 'reload'>;
};

/**
 * What to show before the data arrives: a spinner, or the error with a retry.
 * Renders nothing once there is data (a failed refresh keeps the old data).
 */
export function RemoteState({ remote }: Props) {
  if (remote.data !== null) return null;
  if (remote.error) {
    return (
      <View style={styles.box}>
        <AppText tone="muted" style={styles.centered}>
          {remote.error}
        </AppText>
        <Button label="Try again" variant="secondary" onPress={remote.reload} />
      </View>
    );
  }
  return (
    <View style={styles.box}>
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    paddingVertical: spacing.xxl,
    gap: spacing.lg,
    alignItems: 'center',
  },
  centered: {
    textAlign: 'center',
  },
});

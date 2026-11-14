import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { PublicUser } from '@shared/api';

import { AppText } from '@/components/AppText';
import { minTouchTarget, spacing } from '@/theme/tokens';

import { Avatar } from './Avatar';

type Props = {
  user: PublicUser;
  subtitle?: string;
  /** Buttons shown on the right, e.g. Accept / Decline. */
  right?: ReactNode;
  onPress?: () => void;
};

/** A person in a list. Tapping opens their profile unless `onPress` says otherwise. */
export function UserRow({ user, subtitle, right, onPress }: Props) {
  const open = onPress ?? (() => openProfile(user.username));
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${user.displayName}, @${user.username}`}
        onPress={open}
        style={({ pressed }) => [styles.main, pressed && styles.pressed]}
      >
        <Avatar name={user.displayName || user.username} />
        <View style={styles.text}>
          <AppText numberOfLines={1}>{user.displayName || user.username}</AppText>
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            {subtitle ?? `@${user.username}`}
          </AppText>
        </View>
      </Pressable>
      {right}
    </View>
  );
}

export function openProfile(username: string): void {
  router.push({ pathname: '/community/user/[username]', params: { username } });
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: minTouchTarget + spacing.sm,
  },
  main: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  pressed: {
    opacity: 0.7,
  },
  text: {
    flex: 1,
  },
});

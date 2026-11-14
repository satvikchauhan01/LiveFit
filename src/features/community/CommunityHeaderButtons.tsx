import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import { colors, radius, spacing } from '@/theme/tokens';

import { useCommunityReady, useCommunityStore } from './communityStore';

/** Search, inbox (with the unread count) and settings, top right of the Community tab. */
export function CommunityHeaderButtons() {
  const ready = useCommunityReady();
  const unread = useCommunityStore((state) => state.unread);
  if (!ready) return null;

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Find people"
        hitSlop={8}
        onPress={() => router.push('/community/search')}
      >
        <Icon name="search" />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={unread > 0 ? `Notifications, ${unread} new` : 'Notifications'}
        hitSlop={8}
        onPress={() => router.push('/community/inbox')}
      >
        <Icon name="notifications-outline" />
        {unread > 0 && (
          <View style={styles.badge}>
            <AppText style={styles.badgeText}>{unread > 99 ? '99+' : unread}</AppText>
          </View>
        )}
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Community settings"
        hitSlop={8}
        onPress={() => router.push('/community/settings')}
      >
        <Icon name="settings-outline" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.xl,
    paddingRight: spacing.lg,
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: colors.textOnAccent,
    fontSize: 11,
    fontWeight: '700',
  },
});

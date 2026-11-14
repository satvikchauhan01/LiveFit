import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import type { InboxItem, PublicUser } from '@shared/api';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { errorMessage } from '@/features/account/apiClient';
import { Avatar } from '@/features/community/Avatar';
import { communityApi } from '@/features/community/communityApi';
import { useCommunityStore } from '@/features/community/communityStore';
import { RemoteState } from '@/features/community/RemoteState';
import { UserRow } from '@/features/community/UserRow';
import { useRemote } from '@/features/community/useRemote';
import { formatTimeAgo } from '@/lib/format';
import { colors, radius, spacing } from '@/theme/tokens';

type Loaded = { items: InboxItem[]; requests: PublicUser[]; loadedAt: number };

function describe(item: InboxItem): string {
  const name = item.actor?.displayName || item.actor?.username || 'Someone';
  const others =
    item.count > 1 ? ` and ${item.count - 1} ${item.count === 2 ? 'other' : 'others'}` : '';
  switch (item.type) {
    case 'follow':
      return `${name} started following you`;
    case 'follow_request':
      return `${name} asked to follow you`;
    case 'follow_accepted':
      return `${name} accepted your follow request`;
    case 'kudos':
      return `${name}${others} gave you kudos`;
    case 'comment':
      return `${name}${others} commented on your workout`;
    case 'club_join':
      return `${name} joined your club`;
    case 'challenge_started':
      return `${name} started a challenge in your club`;
    case 'challenge_completed':
      return item.actor ? `${name} finished a challenge` : 'You finished a challenge!';
  }
}

function open(item: InboxItem): void {
  if (item.workoutId) {
    router.push({ pathname: '/community/workout/[id]', params: { id: item.workoutId } });
  } else if (item.challengeId) {
    router.push({ pathname: '/community/challenge/[id]', params: { id: item.challengeId } });
  } else if (item.clubId) {
    router.push({ pathname: '/community/club/[id]', params: { id: item.clubId } });
  } else if (item.actor) {
    router.push({
      pathname: '/community/user/[username]',
      params: { username: item.actor.username },
    });
  }
}

export default function InboxScreen() {
  const remote = useRemote(
    useCallback(async (): Promise<Loaded> => {
      const [{ items }, { users }] = await Promise.all([
        communityApi.inbox(),
        communityApi.followRequests(),
      ]);
      // Seen now: clear the badge. These items keep their "new" dot until next time.
      useCommunityStore
        .getState()
        .clearUnread()
        .catch(() => {});
      return { items, requests: users, loadedAt: Date.now() };
    }, []),
  );
  const [answering, setAnswering] = useState<string | null>(null);

  const answer = async (user: PublicUser, accept: boolean) => {
    setAnswering(user.id);
    try {
      await communityApi.answerRequest(user.id, accept);
      remote.reload();
    } catch (error) {
      Alert.alert('Something went wrong', errorMessage(error));
    } finally {
      setAnswering(null);
    }
  };

  const data = remote.data;

  return (
    <Screen edges={['bottom']}>
      <RemoteState remote={remote} />
      {data && data.requests.length > 0 && (
        <Card>
          <AppText variant="label" tone="muted">
            Follow requests
          </AppText>
          {data.requests.map((user) => (
            <View key={user.id} style={styles.request}>
              <UserRow user={user} />
              <View style={styles.requestButtons}>
                <View style={styles.flex}>
                  <Button
                    label="Accept"
                    disabled={answering === user.id}
                    onPress={() => answer(user, true)}
                  />
                </View>
                <View style={styles.flex}>
                  <Button
                    label="Decline"
                    variant="secondary"
                    disabled={answering === user.id}
                    onPress={() => answer(user, false)}
                  />
                </View>
              </View>
            </View>
          ))}
        </Card>
      )}
      {data && data.items.length === 0 && data.requests.length === 0 && (
        <EmptyState
          icon="notifications-outline"
          title="All quiet"
          message="Kudos, comments, new followers and challenge news show up here."
        />
      )}
      {data?.items.map((item) => (
        <Pressable
          key={item.id}
          accessibilityRole="button"
          onPress={() => open(item)}
          style={({ pressed }) => [styles.item, pressed && styles.pressed]}
        >
          <Avatar name={item.actor?.displayName || item.actor?.username || 'LiveFit'} size={36} />
          <View style={styles.flex}>
            <AppText>{describe(item)}</AppText>
            <AppText variant="caption" tone="muted">
              {formatTimeAgo(item.createdAt, data.loadedAt)}
            </AppText>
          </View>
          {!item.read && <View style={styles.dot} accessibilityLabel="New" />}
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  request: {
    gap: spacing.sm,
  },
  requestButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  flex: {
    flex: 1,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  pressed: {
    opacity: 0.7,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
});

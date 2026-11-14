import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';

import { AppText } from '@/components/AppText';
import { Screen } from '@/components/Screen';
import { communityApi } from '@/features/community/communityApi';
import { RemoteState } from '@/features/community/RemoteState';
import { UserRow } from '@/features/community/UserRow';
import { useRemote } from '@/features/community/useRemote';

/** Someone's followers, or the people they follow. */
export default function ConnectionsScreen() {
  const { userId, list, name } = useLocalSearchParams<{
    userId: string;
    list: 'followers' | 'following';
    name?: string;
  }>();
  const remote = useRemote(
    useCallback(
      () =>
        list === 'following' ? communityApi.following(userId) : communityApi.followers(userId),
      [userId, list],
    ),
  );
  const title = list === 'following' ? 'Following' : 'Followers';

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: name ? `${name} · ${title}` : title }} />
      <RemoteState remote={remote} />
      {remote.data?.users.length === 0 && <AppText tone="muted">Nobody yet.</AppText>}
      {remote.data?.users.map((user) => (
        <UserRow key={user.id} user={user} />
      ))}
    </Screen>
  );
}

import { useCallback } from 'react';
import { Alert } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { errorMessage } from '@/features/account/apiClient';
import { communityApi } from '@/features/community/communityApi';
import { RemoteState } from '@/features/community/RemoteState';
import { UserRow } from '@/features/community/UserRow';
import { useRemote } from '@/features/community/useRemote';

export default function BlockedScreen() {
  const remote = useRemote(useCallback(() => communityApi.blocked(), []));

  const unblock = (id: string) =>
    communityApi
      .unblock(id)
      .then(remote.reload)
      .catch((error: unknown) => Alert.alert('Couldn’t unblock', errorMessage(error)));

  return (
    <Screen edges={['bottom']}>
      <RemoteState remote={remote} />
      {remote.data?.users.length === 0 && (
        <AppText tone="muted">You haven’t blocked anyone.</AppText>
      )}
      {remote.data?.users.map((user) => (
        <UserRow
          key={user.id}
          user={user}
          onPress={() => {}}
          right={<Button label="Unblock" variant="secondary" onPress={() => unblock(user.id)} />}
        />
      ))}
    </Screen>
  );
}

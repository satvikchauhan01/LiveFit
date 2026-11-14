import { useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { Alert, Pressable } from 'react-native';

import type { ClubMember } from '@shared/api';

import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { useAccountStore } from '@/features/account/accountStore';
import { errorMessage } from '@/features/account/apiClient';
import { communityApi } from '@/features/community/communityApi';
import { RemoteState } from '@/features/community/RemoteState';
import { UserRow } from '@/features/community/UserRow';
import { useRemote } from '@/features/community/useRemote';

const ROLE_LABEL = { owner: 'Owner', admin: 'Admin', member: 'Member' } as const;

export default function ClubMembersScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const myId = useAccountStore((state) => state.user?.id);
  const remote = useRemote(useCallback(() => communityApi.club(id), [id]));

  const myRole = remote.data?.club.role;
  const canManage = myRole === 'owner' || myRole === 'admin';

  const act = (action: () => Promise<unknown>) =>
    action()
      .then(remote.reload)
      .catch((error: unknown) => Alert.alert('Something went wrong', errorMessage(error)));

  const manage = (member: ClubMember) => {
    const options = [];
    // Only the owner hands out (or takes back) admin rights.
    if (myRole === 'owner') {
      options.push(
        member.role === 'admin'
          ? {
              text: 'Make member',
              onPress: () => act(() => communityApi.setMemberRole(id, member.id, 'member')),
            }
          : {
              text: 'Make admin',
              onPress: () => act(() => communityApi.setMemberRole(id, member.id, 'admin')),
            },
      );
    }
    options.push({
      text: 'Remove from club',
      style: 'destructive' as const,
      onPress: () => act(() => communityApi.removeMember(id, member.id)),
    });
    Alert.alert(member.displayName || member.username, ROLE_LABEL[member.role], [
      ...options,
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  return (
    <Screen edges={['bottom']}>
      <RemoteState remote={remote} />
      {remote.data?.members.map((member) => (
        <UserRow
          key={member.id}
          user={member}
          subtitle={`@${member.username} · ${ROLE_LABEL[member.role]}`}
          right={
            canManage &&
            member.id !== myId &&
            member.role !== 'owner' &&
            (myRole === 'owner' || member.role === 'member') ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Manage ${member.displayName}`}
                hitSlop={12}
                onPress={() => manage(member)}
              >
                <Icon name="ellipsis-vertical" size={20} />
              </Pressable>
            ) : undefined
          }
        />
      ))}
    </Screen>
  );
}

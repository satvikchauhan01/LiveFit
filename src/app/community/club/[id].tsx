import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, Share, StyleSheet, View } from 'react-native';

import type { ClubSummary } from '@shared/api';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Icon } from '@/components/Icon';
import { API_URL, errorMessage } from '@/features/account/apiClient';
import { communityApi } from '@/features/community/communityApi';
import { FeedList } from '@/features/community/FeedList';
import { RemoteState } from '@/features/community/RemoteState';
import { reportContent } from '@/features/community/report';
import { useRemote } from '@/features/community/useRemote';
import { spacing } from '@/theme/tokens';

export default function ClubScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const remote = useRemote(useCallback(() => communityApi.club(id), [id]));
  const loadFeed = useCallback(() => communityApi.clubFeed(id), [id]);
  const [busy, setBusy] = useState(false);

  const club = remote.data?.club;
  const canManage = club?.role === 'owner' || club?.role === 'admin';

  const shareInvite = (summary: ClubSummary) => {
    if (!summary.inviteCode) return;
    Share.share({
      message: `Join my club “${summary.name}” on LiveFit: ${API_URL}/join/club/${summary.inviteCode} (invite code ${summary.inviteCode})`,
    });
  };

  const newCode = () =>
    Alert.alert(
      'Make a new invite code?',
      'The old code and link stop working. People already in the club stay.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'New code',
          onPress: () =>
            communityApi
              .newClubInvite(id)
              .then(remote.reload)
              .catch((error: unknown) => Alert.alert('Something went wrong', errorMessage(error))),
        },
      ],
    );

  const leaveOrDelete = () => {
    if (!club) return;
    const owner = club.role === 'owner';
    Alert.alert(
      owner ? `Delete “${club.name}”?` : `Leave “${club.name}”?`,
      owner
        ? 'Everyone is removed and its challenges end. Workouts stay with the people who did them.'
        : undefined,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: owner ? 'Delete club' : 'Leave',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await (owner ? communityApi.deleteClub(id) : communityApi.removeMember(id, 'me'));
              router.back();
            } catch (error) {
              Alert.alert('Something went wrong', errorMessage(error));
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  const header = club ? (
    <View style={styles.header}>
      <Card>
        <AppText variant="headline">{club.name}</AppText>
        {club.description !== '' && <AppText tone="muted">{club.description}</AppText>}
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            router.push({ pathname: '/community/club/members', params: { id: club.id } })
          }
          style={styles.membersLink}
        >
          <Icon name="people-outline" size={18} />
          <AppText style={styles.flex}>
            {club.members} {club.members === 1 ? 'member' : 'members'}
          </AppText>
          <Icon name="chevron-forward" size={18} />
        </Pressable>
        {club.inviteCode && (
          <AppText variant="caption" tone="muted">
            Invite code: {club.inviteCode}
          </AppText>
        )}
      </Card>
      {club.inviteCode && <Button label="Invite people" onPress={() => shareInvite(club)} />}
      <Button
        label="Start a club challenge"
        variant="secondary"
        onPress={() =>
          router.push({ pathname: '/community/challenge/new', params: { clubId: club.id } })
        }
      />
      {canManage && <Button label="Make a new invite code" variant="ghost" onPress={newCode} />}
      {club.role && (
        <Button
          label={club.role === 'owner' ? 'Delete club' : 'Leave club'}
          variant="ghost"
          disabled={busy}
          onPress={leaveOrDelete}
        />
      )}
      <AppText variant="label" tone="muted">
        Club feed
      </AppText>
    </View>
  ) : (
    <RemoteState remote={remote} />
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: club?.name ?? '',
          headerRight: club
            ? () => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Report this club"
                  hitSlop={12}
                  onPress={() => reportContent('club', club.id)}
                >
                  <Icon name="flag-outline" />
                </Pressable>
              )
            : undefined,
        }}
      />
      <FeedList
        load={loadFeed}
        header={header}
        empty={
          <EmptyState
            icon="newspaper-outline"
            title="No club workouts yet"
            message="Workouts members share with “Club” or everyone show up here."
          />
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.md,
  },
  flex: {
    flex: 1,
  },
  membersLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
});

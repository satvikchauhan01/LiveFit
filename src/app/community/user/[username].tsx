import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, Share, StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import type { PublicProfile, SharedWorkout } from '@shared/api';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { API_URL, errorMessage } from '@/features/account/apiClient';
import { Avatar } from '@/features/community/Avatar';
import { communityApi } from '@/features/community/communityApi';
import { toggleKudos } from '@/features/community/kudos';
import { RemoteState } from '@/features/community/RemoteState';
import { reportContent } from '@/features/community/report';
import { SharedWorkoutCard } from '@/features/community/SharedWorkoutCard';
import { useRemote } from '@/features/community/useRemote';
import { colors, radius, spacing } from '@/theme/tokens';

type Loaded = { profile: PublicProfile; workouts: SharedWorkout[] };

export default function UserProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const remote = useRemote(
    useCallback(async (): Promise<Loaded> => {
      const profile = await communityApi.profileByUsername(username);
      const workouts = profile.canSeeWorkouts
        ? (await communityApi.userWorkouts(profile.id)).items
        : [];
      return { profile, workouts };
    }, [username]),
  );
  const [busy, setBusy] = useState(false);
  const [showCode, setShowCode] = useState(false);

  const data = remote.data;
  const profile = data?.profile;
  const link = `${API_URL}/u/${username}`;

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
      remote.reload();
    } catch (error) {
      Alert.alert('Something went wrong', errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const confirmUnfollow = () => {
    if (!profile) return;
    Alert.alert(
      profile.followState === 'pending'
        ? 'Cancel your request?'
        : `Unfollow ${profile.displayName}?`,
      undefined,
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: profile.followState === 'pending' ? 'Cancel request' : 'Unfollow',
          style: 'destructive',
          onPress: () => run(() => communityApi.unfollow(profile.id)),
        },
      ],
    );
  };

  const openMenu = () => {
    if (!profile) return;
    Alert.alert(profile.displayName, `@${profile.username}`, [
      profile.blocked
        ? { text: 'Unblock', onPress: () => run(() => communityApi.unblock(profile.id)) }
        : {
            text: 'Block',
            style: 'destructive',
            onPress: () =>
              Alert.alert(
                `Block ${profile.displayName}?`,
                'You won’t see each other’s workouts or comments, and any follows between you are removed. They aren’t told.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Block',
                    style: 'destructive',
                    onPress: () => run(() => communityApi.block(profile.id)),
                  },
                ],
              ),
          },
      { text: 'Report', onPress: () => reportContent('user', profile.id) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const replaceWorkout = (updated: SharedWorkout) => {
    if (!data) return;
    remote.setData({
      ...data,
      workouts: data.workouts.map((item) => (item.id === updated.id ? updated : item)),
    });
  };

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen
        options={{
          title: profile ? `@${profile.username}` : '',
          headerRight:
            profile && !profile.isMe
              ? () => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="More options"
                    hitSlop={12}
                    onPress={openMenu}
                  >
                    <Icon name="ellipsis-vertical" />
                  </Pressable>
                )
              : undefined,
        }}
      />
      <RemoteState remote={remote} />
      {profile && (
        <>
          <View style={styles.header}>
            <Avatar name={profile.displayName || profile.username} size={72} />
            <View style={styles.flex}>
              <AppText variant="title">{profile.displayName || profile.username}</AppText>
              <AppText tone="muted">
                @{profile.username}
                {profile.followsYou && !profile.isMe ? ' · Follows you' : ''}
              </AppText>
            </View>
          </View>
          {profile.bio !== '' && <AppText>{profile.bio}</AppText>}

          <View style={styles.counts}>
            <Pressable
              accessibilityRole="button"
              disabled={!profile.canSeeWorkouts}
              onPress={() =>
                router.push({
                  pathname: '/community/connections',
                  params: { userId: profile.id, list: 'followers', name: profile.displayName },
                })
              }
            >
              <AppText numeric variant="title">
                {profile.followers}
              </AppText>
              <AppText variant="caption" tone="muted">
                Followers
              </AppText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={!profile.canSeeWorkouts}
              onPress={() =>
                router.push({
                  pathname: '/community/connections',
                  params: { userId: profile.id, list: 'following', name: profile.displayName },
                })
              }
            >
              <AppText numeric variant="title">
                {profile.following}
              </AppText>
              <AppText variant="caption" tone="muted">
                Following
              </AppText>
            </Pressable>
          </View>

          {profile.isMe ? (
            <View style={styles.buttons}>
              <Button
                label="Edit profile and privacy"
                variant="secondary"
                onPress={() => router.push('/community/settings')}
              />
              <Button
                label={showCode ? 'Hide QR code' : 'Show my QR code'}
                variant="secondary"
                onPress={() => setShowCode((value) => !value)}
              />
              <Button
                label="Share my profile link"
                variant="ghost"
                onPress={() => Share.share({ message: `Follow me on LiveFit: ${link}` })}
              />
            </View>
          ) : profile.blocked ? (
            <AppText tone="muted">You’ve blocked this person.</AppText>
          ) : profile.followState === 'none' ? (
            <Button
              label={profile.isPrivate ? 'Ask to follow' : 'Follow'}
              disabled={busy}
              onPress={() => run(() => communityApi.follow(profile.id))}
            />
          ) : (
            <Button
              label={profile.followState === 'pending' ? 'Requested' : 'Following'}
              variant="secondary"
              disabled={busy}
              onPress={confirmUnfollow}
            />
          )}

          {showCode && (
            <View style={styles.code}>
              <QRCode value={link} size={200} backgroundColor="#FFFFFF" color="#000000" />
              <AppText variant="caption" tone="muted">
                Friends can scan this with their phone camera.
              </AppText>
            </View>
          )}

          {!profile.canSeeWorkouts && !profile.isMe && (
            <Card>
              <AppText>This profile is private.</AppText>
              <AppText tone="muted">
                Follow {profile.displayName || profile.username} to see their workouts.
              </AppText>
            </Card>
          )}
          {profile.canSeeWorkouts && data.workouts.length === 0 && (
            <AppText tone="muted">No shared workouts yet.</AppText>
          )}
          {data.workouts.map((workout) => (
            <SharedWorkoutCard
              key={workout.id}
              workout={workout}
              onKudos={(item) => toggleKudos(item, replaceWorkout)}
            />
          ))}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  flex: {
    flex: 1,
  },
  counts: {
    flexDirection: 'row',
    gap: spacing.xxl,
  },
  buttons: {
    gap: spacing.sm,
  },
  code: {
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
});

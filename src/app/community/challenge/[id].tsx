import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Share, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { useAccountStore } from '@/features/account/accountStore';
import { API_URL, errorMessage } from '@/features/account/apiClient';
import { Avatar } from '@/features/community/Avatar';
import {
  activitiesText,
  CHALLENGE_KIND_LABEL,
  datesText,
  scoreText,
  targetText,
} from '@/features/community/challengeText';
import { communityApi } from '@/features/community/communityApi';
import { RemoteState } from '@/features/community/RemoteState';
import { openProfile } from '@/features/community/UserRow';
import { useRemote } from '@/features/community/useRemote';
import { useProfile } from '@/features/profile/profileStore';
import { colors, radius, spacing } from '@/theme/tokens';

export default function ChallengeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const profile = useProfile();
  const me = useAccountStore((state) => state.user);
  const remote = useRemote(
    useCallback(
      async () => ({ ...(await communityApi.challenge(id)), loadedAt: Date.now() }),
      [id],
    ),
  );
  const [busy, setBusy] = useState(false);

  const units = { distance: profile.distanceUnit, weight: profile.weightUnit };
  const data = remote.data;
  const challenge = data?.challenge;

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

  const leave = () =>
    Alert.alert('Leave this challenge?', 'You’ll drop off the leaderboard.', [
      { text: 'Stay', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: () => run(() => communityApi.leaveChallenge(id)),
      },
    ]);

  const ended = challenge && data ? data.loadedAt > challenge.endsAt : false;

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: '' }} />
      <RemoteState remote={remote} />
      {challenge && data && (
        <>
          <AppText variant="headline">{challenge.title}</AppText>
          <Card>
            <AppText variant="title">{targetText(challenge, units)}</AppText>
            <AppText>
              {CHALLENGE_KIND_LABEL[challenge.kind]} · {activitiesText(challenge.activityTypes)}
            </AppText>
            <AppText tone="muted">
              {datesText(challenge, data.loadedAt)} · {challenge.participants}{' '}
              {challenge.participants === 1 ? 'person' : 'people'}
            </AppText>
            <AppText variant="caption" tone="muted">
              {challenge.allowManual
                ? 'Workouts typed in by hand count too.'
                : 'Only workouts recorded live count. GPS workouts that fail the fair-play checks don’t.'}
            </AppText>
          </Card>

          {!ended &&
            (challenge.joined ? (
              <Button label="Leave challenge" variant="ghost" disabled={busy} onPress={leave} />
            ) : (
              <Button
                label="Join challenge"
                disabled={busy}
                onPress={() => run(() => communityApi.joinChallenge(id))}
              />
            ))}
          {challenge.inviteCode && !ended && (
            <Button
              label="Invite people"
              variant="secondary"
              onPress={() =>
                Share.share({
                  message: `Join my LiveFit challenge “${challenge.title}”: ${API_URL}/join/challenge/${challenge.inviteCode} (invite code ${challenge.inviteCode})`,
                })
              }
            />
          )}
          {me?.isAdmin && challenge.isPublic && (
            <Button
              label={challenge.featured ? 'Stop featuring' : 'Feature this challenge'}
              variant="ghost"
              disabled={busy}
              onPress={() => run(() => communityApi.featureChallenge(id, !challenge.featured))}
            />
          )}

          <AppText variant="label" tone="muted">
            Leaderboard
          </AppText>
          {data.leaderboard.length === 0 && <AppText tone="muted">Nobody has joined yet.</AppText>}
          {data.leaderboard.map((row, index) => (
            <View
              key={row.user.id}
              style={[styles.row, row.user.id === me?.id && styles.mine]}
              accessible
              accessibilityLabel={`${index + 1}. ${row.user.displayName}, ${scoreText(challenge.kind, row, units)}${row.completed ? ', finished' : ''}`}
            >
              <AppText numeric style={styles.rank}>
                {index + 1}
              </AppText>
              <Avatar name={row.user.displayName || row.user.username} size={32} />
              <View style={styles.flex}>
                <AppText
                  numberOfLines={1}
                  onPress={() => openProfile(row.user.username)}
                  suppressHighlighting
                >
                  {row.user.displayName || row.user.username}
                </AppText>
                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${Math.min(1, row.progress) * 100}%` }]} />
                </View>
                <AppText variant="caption" tone="muted" numeric>
                  {scoreText(challenge.kind, row, units)}
                </AppText>
              </View>
              {row.completed && <Icon name="checkmark-circle" color={colors.accent} />}
            </View>
          ))}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.md,
  },
  mine: {
    backgroundColor: colors.surface,
  },
  rank: {
    width: 24,
    textAlign: 'center',
  },
  flex: {
    flex: 1,
    gap: spacing.xs,
  },
  track: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
    overflow: 'hidden',
  },
  fill: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
});

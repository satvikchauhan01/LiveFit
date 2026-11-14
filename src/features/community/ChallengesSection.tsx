import { router } from 'expo-router';
import { useCallback } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { spacing } from '@/theme/tokens';

import { ChallengeCard } from './ChallengeCard';
import { communityApi } from './communityApi';
import { RemoteState } from './RemoteState';
import { useRemote } from './useRemote';

/** Challenges you're in, and public ones you could join. */
export function ChallengesSection() {
  const remote = useRemote(
    useCallback(async () => {
      const [mine, open] = await Promise.all([
        communityApi.challenges(),
        communityApi.publicChallenges(),
      ]);
      return { mine: mine.challenges, open: open.challenges, loadedAt: Date.now() };
    }, []),
  );
  const data = remote.data;
  const now = data?.loadedAt ?? 0;
  const joinedIds = new Set(data?.mine.map((challenge) => challenge.id));
  const open = data?.open.filter((challenge) => !joinedIds.has(challenge.id)) ?? [];

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <RemoteState remote={remote} />
      {data && data.mine.length === 0 && (
        <EmptyState
          icon="trophy-outline"
          title="No challenges yet"
          message="Race friends to a distance, a number of workouts or a total weight lifted, over a few days or weeks."
        />
      )}
      {data?.mine.map((challenge) => (
        <ChallengeCard key={challenge.id} challenge={challenge} now={now} />
      ))}
      <Button label="Start a challenge" onPress={() => router.push('/community/challenge/new')} />
      <Button
        label="Join with an invite code"
        variant="secondary"
        onPress={() => router.push({ pathname: '/community/join', params: { type: 'challenge' } })}
      />
      {open.length > 0 && (
        <>
          <AppText variant="label" tone="muted" style={styles.section}>
            Open to everyone
          </AppText>
          {open.map((challenge) => (
            <ChallengeCard key={challenge.id} challenge={challenge} now={now} />
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  section: {
    marginTop: spacing.md,
  },
});

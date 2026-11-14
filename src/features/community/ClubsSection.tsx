import { router } from 'expo-router';
import { useCallback } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { ListRow } from '@/components/ListRow';
import { spacing } from '@/theme/tokens';

import { communityApi } from './communityApi';
import { RemoteState } from './RemoteState';
import { useRemote } from './useRemote';

/** Your clubs, and ways to start or join one. */
export function ClubsSection() {
  const remote = useRemote(useCallback(() => communityApi.clubs(), []));
  const clubs = remote.data?.clubs;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <RemoteState remote={remote} />
      {clubs && clubs.length === 0 && (
        <EmptyState
          icon="people-outline"
          title="No clubs yet"
          message="Clubs are small groups (a running crew, your gym friends) with their own feed and challenges. Start one, or join with an invite code."
        />
      )}
      {clubs && clubs.length > 0 && (
        <Card>
          {clubs.map((club) => (
            <ListRow
              key={club.id}
              icon="people"
              title={club.name}
              subtitle={`${club.members} ${club.members === 1 ? 'member' : 'members'}${
                club.role === 'owner' ? ' · You run it' : club.role === 'admin' ? ' · Admin' : ''
              }`}
              onPress={() =>
                router.push({ pathname: '/community/club/[id]', params: { id: club.id } })
              }
            />
          ))}
        </Card>
      )}
      <Button label="Start a club" onPress={() => router.push('/community/club/new')} />
      <Button
        label="Join with an invite code"
        variant="secondary"
        onPress={() => router.push({ pathname: '/community/join', params: { type: 'club' } })}
      />
      <AppText variant="caption" tone="muted" style={styles.note}>
        Club members see workouts shared with “Club”, plus anything shared with everyone.
      </AppText>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  note: {
    textAlign: 'center',
  },
});

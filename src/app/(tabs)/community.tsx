import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { SegmentedControl } from '@/components/SegmentedControl';
import { useAccountStore } from '@/features/account/accountStore';
import { serverConfigured } from '@/features/account/apiClient';
import { ChallengesSection } from '@/features/community/ChallengesSection';
import { ClubsSection } from '@/features/community/ClubsSection';
import { communityApi } from '@/features/community/communityApi';
import { FeedList } from '@/features/community/FeedList';
import { UsernameForm } from '@/features/community/UsernameForm';
import { spacing } from '@/theme/tokens';

type Section = 'feed' | 'clubs' | 'challenges';

const SECTIONS: { value: Section; label: string }[] = [
  { value: 'feed', label: 'Feed' },
  { value: 'clubs', label: 'Clubs' },
  { value: 'challenges', label: 'Challenges' },
];

export default function CommunityScreen() {
  const status = useAccountStore((state) => state.status);
  const username = useAccountStore((state) => state.user?.username ?? null);
  const [section, setSection] = useState<Section>('feed');

  if (!serverConfigured) {
    return (
      <Screen>
        <EmptyState
          icon="people-outline"
          title="Community isn’t set up"
          message="This build of LiveFit has no server address, so sharing and clubs are off. Your own workouts work as usual."
        />
      </Screen>
    );
  }

  if (status !== 'signedIn') {
    return (
      <Screen>
        <EmptyState
          icon="people-outline"
          title="Train with friends"
          message="Follow friends, give kudos, join clubs and race each other in challenges. You need a free account; your workouts stay private until you choose to share them."
          actionLabel="Sign in or create an account"
          onAction={() => router.push('/account')}
        />
      </Screen>
    );
  }

  if (!username) {
    return (
      <Screen>
        <AppText variant="headline">Pick a username</AppText>
        <AppText tone="muted">
          It’s how friends find and mention you. Your profile starts private: people have to ask to
          follow you, and your workouts are only shared when you say so.
        </AppText>
        <UsernameForm buttonLabel="Join the community" />
      </Screen>
    );
  }

  return (
    <View style={styles.fill}>
      <View style={styles.tabs}>
        <SegmentedControl
          options={SECTIONS}
          value={section}
          onChange={setSection}
          accessibilityLabel="Community section"
        />
      </View>
      {section === 'feed' && (
        <FeedList
          load={communityApi.feed}
          empty={
            <EmptyState
              icon="newspaper-outline"
              title="Nothing here yet"
              message="Workouts from people you follow show up here. Find friends by their username."
              actionLabel="Find people"
              onAction={() => router.push('/community/search')}
            />
          }
        />
      )}
      {section === 'clubs' && <ClubsSection />}
      {section === 'challenges' && <ChallengesSection />}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  tabs: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
});

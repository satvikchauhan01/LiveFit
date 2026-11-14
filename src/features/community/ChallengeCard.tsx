import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import type { ChallengeSummary } from '@shared/api';

import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { useProfile } from '@/features/profile/profileStore';
import { colors, spacing } from '@/theme/tokens';

import { activitiesText, datesText, targetText } from './challengeText';

type Props = {
  challenge: ChallengeSummary;
  now: number;
};

export function ChallengeCard({ challenge, now }: Props) {
  const profile = useProfile();
  const units = { distance: profile.distanceUnit, weight: profile.weightUnit };

  return (
    <Card
      onPress={() =>
        router.push({ pathname: '/community/challenge/[id]', params: { id: challenge.id } })
      }
      accessibilityLabel={challenge.title}
    >
      <View style={styles.header}>
        <Icon name="trophy-outline" size={20} color={colors.accent} />
        <AppText variant="title" style={styles.flex} numberOfLines={2}>
          {challenge.title}
        </AppText>
        {challenge.featured && (
          <AppText variant="caption" tone="accent">
            Featured
          </AppText>
        )}
      </View>
      <AppText>
        {targetText(challenge, units)} · {activitiesText(challenge.activityTypes)}
      </AppText>
      <AppText variant="caption" tone="muted">
        {datesText(challenge, now)} · {challenge.participants}{' '}
        {challenge.participants === 1 ? 'person' : 'people'}
        {challenge.joined ? ' · Joined' : ''}
      </AppText>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  flex: {
    flex: 1,
  },
});

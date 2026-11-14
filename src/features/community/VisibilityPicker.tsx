import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import type { Visibility } from '@shared/api';

import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { ListRow } from '@/components/ListRow';
import { spacing } from '@/theme/tokens';

import { useCommunityReady } from './communityStore';
import { VISIBILITY_OPTIONS } from './visibility';

type Props = {
  workoutId: string;
  value: Visibility;
  onChange: (value: Visibility) => void;
  /** Offer a link to how others see it (not on the just-finished summary). */
  showCommunityLink?: boolean;
};

/** Who can see one of your workouts. Only shown once you've joined the community. */
export function VisibilityPicker({ workoutId, value, onChange, showCommunityLink = false }: Props) {
  const ready = useCommunityReady();
  if (!ready) return null;
  const selected = VISIBILITY_OPTIONS.find((option) => option.value === value);

  return (
    <Card>
      <AppText variant="label" tone="muted">
        Who can see this
      </AppText>
      <View style={styles.chips}>
        {VISIBILITY_OPTIONS.map((option) => (
          <Chip
            key={option.value}
            label={option.label}
            selected={value === option.value}
            onPress={() => onChange(option.value)}
          />
        ))}
      </View>
      {selected && (
        <AppText variant="caption" tone="muted">
          {selected.description}
        </AppText>
      )}
      {showCommunityLink && value !== 'only_me' && (
        <ListRow
          icon="people-outline"
          title="See it as others do"
          subtitle="Kudos and comments"
          onPress={() =>
            router.push({ pathname: '/community/workout/[id]', params: { id: workoutId } })
          }
        />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});

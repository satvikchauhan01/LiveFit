import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { Icon, type IconName } from '@/components/Icon';
import { ListRow } from '@/components/ListRow';
import { Screen } from '@/components/Screen';
import { ACTIVITY_TYPES, type ActivityType } from '@/db/schema';
import { startStrengthWorkout } from '@/features/strength/startStrengthWorkout';
import { ACTIVITY_DISPLAY } from '@/features/workouts/activities';
import { colors, radius, spacing } from '@/theme/tokens';

function ActivityCard({
  icon,
  title,
  description,
  onPress,
}: {
  icon: IconName;
  title: string;
  description: string;
  onPress: () => void;
}) {
  return (
    <Card onPress={onPress} accessibilityLabel={`${title}: ${description}`} style={styles.card}>
      <View style={styles.iconCircle}>
        <Icon name={icon} size={26} color={colors.accent} />
      </View>
      <View style={styles.text}>
        <AppText variant="title">{title}</AppText>
        <AppText tone="muted">{description}</AppText>
      </View>
      <Icon name="chevron-forward" color={colors.textMuted} />
    </Card>
  );
}

export default function ActivityPickerScreen() {
  const [starting, setStarting] = useState(false);

  const handlePick = async (activity: ActivityType) => {
    if (activity !== 'strength') {
      router.push({ pathname: '/record/ready', params: { activity } });
      return;
    }
    if (starting) return;
    setStarting(true);
    // No GPS or countdown for strength: the workout opens straight away.
    if (await startStrengthWorkout()) {
      router.replace('/strength');
    } else {
      setStarting(false);
    }
  };

  return (
    <Screen edges={['bottom']}>
      <AppText tone="muted">What are you doing today?</AppText>
      <View style={styles.list}>
        {ACTIVITY_TYPES.map((activity) => (
          <ActivityCard
            key={activity}
            icon={ACTIVITY_DISPLAY[activity].icon}
            title={ACTIVITY_DISPLAY[activity].label}
            description={ACTIVITY_DISPLAY[activity].description}
            onPress={() => handlePick(activity)}
          />
        ))}
      </View>
      <Card>
        <ListRow
          icon="create-outline"
          title="Log a past workout"
          subtitle="Type in the time and distance"
          onPress={() => router.push('/record/manual')}
        />
        <ListRow
          icon="document-attach-outline"
          title="Import a GPX file"
          subtitle="From a watch, another app or a route you saved"
          onPress={() => router.push('/record/import')}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.md,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    gap: 2,
  },
});

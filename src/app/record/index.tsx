import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { Icon, type IconName } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { startStrengthWorkout } from '@/features/strength/startStrengthWorkout';
import { colors, radius, spacing } from '@/theme/tokens';

type ActivityOption = {
  id: 'run' | 'walk' | 'strength';
  title: string;
  description: string;
  icon: IconName;
};

// Release 1 activities. Cycling, hiking and wheelchair join in Release 2.
const ACTIVITIES: ActivityOption[] = [
  { id: 'run', title: 'Run', description: 'GPS distance, pace and splits', icon: 'walk' },
  { id: 'walk', title: 'Walk', description: 'GPS distance and route', icon: 'footsteps' },
  {
    id: 'strength',
    title: 'Strength',
    description: 'Exercises, sets, reps and weight',
    icon: 'barbell',
  },
];

export default function ActivityPickerScreen() {
  const [starting, setStarting] = useState(false);

  const handlePick = async (activity: ActivityOption) => {
    if (activity.id !== 'strength') {
      router.push({ pathname: '/record/ready', params: { activity: activity.id } });
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
        {ACTIVITIES.map((activity) => (
          <Card
            key={activity.id}
            onPress={() => handlePick(activity)}
            accessibilityLabel={`${activity.title}: ${activity.description}`}
            style={styles.card}
          >
            <View style={styles.iconCircle}>
              <Icon name={activity.icon} size={26} color={colors.accent} />
            </View>
            <View style={styles.text}>
              <AppText variant="title">{activity.title}</AppText>
              <AppText tone="muted">{activity.description}</AppText>
            </View>
            <Icon name="chevron-forward" color={colors.textMuted} />
          </Card>
        ))}
      </View>
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

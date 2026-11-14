import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import type { SharedWorkout } from '@shared/api';

import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { ACTIVITY_TYPES, type ActivityType } from '@/db/schema';
import { useProfile } from '@/features/profile/profileStore';
import { RouteMap } from '@/features/tracking/RouteMap';
import { ACTIVITY_DISPLAY } from '@/features/workouts/activities';
import { formatRate } from '@/features/workouts/rateDisplay';
import {
  formatDistance,
  formatDuration,
  formatMeters,
  formatWeight,
  formatWorkoutDate,
  formatWorkoutDay,
} from '@/lib/format';
import { colors, minTouchTarget, spacing } from '@/theme/tokens';

import { Avatar } from './Avatar';
import { openProfile } from './UserRow';

type Props = {
  workout: SharedWorkout;
  onKudos: (workout: SharedWorkout) => void;
  /** On the workout's own screen the card itself doesn't open anything. */
  openOnPress?: boolean;
  mapHeight?: number;
};

function activityOf(type: string): ActivityType {
  return (ACTIVITY_TYPES as readonly string[]).includes(type) ? (type as ActivityType) : 'run';
}

/** One workout in a feed: who, what, the numbers, the route, kudos and comments. */
export function SharedWorkoutCard({
  workout,
  onKudos,
  openOnPress = true,
  mapHeight = 170,
}: Props) {
  const profile = useProfile();
  const activity = ACTIVITY_DISPLAY[activityOf(workout.type)];
  const when = workout.showTime
    ? formatWorkoutDate(workout.startedAt, workout.timezone)
    : formatWorkoutDay(workout.startedAt, workout.timezone);

  const stats: { label: string; value: string }[] = [];
  if (workout.distanceM !== null && workout.distanceM > 0) {
    stats.push({
      label: 'Distance',
      value: formatDistance(workout.distanceM, profile.distanceUnit),
    });
  }
  if (workout.movingS !== null) {
    stats.push({ label: 'Time', value: formatDuration(workout.movingS * 1000) });
  }
  if (workout.distanceM && workout.movingS && workout.distanceM > 0) {
    const secondsPerKm = workout.movingS / (workout.distanceM / 1000);
    stats.push({
      label: activity.measure === 'pace' ? 'Pace' : 'Speed',
      value: formatRate(secondsPerKm, profile.distanceUnit, activity.measure),
    });
  }
  if (workout.volumeKg !== null && workout.volumeKg > 0) {
    stats.push({ label: 'Volume', value: formatWeight(workout.volumeKg, profile.weightUnit) });
  }
  if (workout.elevationGainM !== null && workout.elevationGainM >= 10) {
    stats.push({ label: 'Climb', value: formatMeters(workout.elevationGainM) });
  }

  const open = () =>
    router.push({ pathname: '/community/workout/[id]', params: { id: workout.id } });

  return (
    <Card
      onPress={openOnPress ? open : undefined}
      accessibilityLabel={
        openOnPress ? `${workout.owner.displayName}: ${workout.title}` : undefined
      }
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${workout.owner.displayName}'s profile`}
        onPress={() => openProfile(workout.owner.username)}
        style={styles.owner}
      >
        <Avatar name={workout.owner.displayName || workout.owner.username} size={36} />
        <View style={styles.flex}>
          <AppText numberOfLines={1}>{workout.owner.displayName || workout.owner.username}</AppText>
          <AppText variant="caption" tone="muted">
            {when}
          </AppText>
        </View>
        <Icon name={activity.icon} size={20} color={colors.textMuted} />
      </Pressable>

      <AppText variant="title">{workout.title}</AppText>

      {stats.length > 0 && (
        <View style={styles.stats}>
          {stats.slice(0, 4).map((stat) => (
            <View key={stat.label}>
              <AppText variant="caption" tone="muted">
                {stat.label}
              </AppText>
              <AppText numeric>{stat.value}</AppText>
            </View>
          ))}
        </View>
      )}

      {workout.route && workout.route.length > 1 && (
        <RouteMap
          height={mapHeight}
          lines={[
            {
              points: workout.route.map(([lat, lng]) => ({ lat, lng })),
              color: colors.accent,
              strokeWidth: 4,
            },
          ]}
        />
      )}

      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: workout.hasKudoed }}
          accessibilityLabel={`${workout.hasKudoed ? 'Remove kudos' : 'Give kudos'}, ${workout.kudos} so far`}
          onPress={() => onKudos(workout)}
          style={styles.action}
        >
          <Icon
            name={workout.hasKudoed ? 'thumbs-up' : 'thumbs-up-outline'}
            size={20}
            color={workout.hasKudoed ? colors.accent : colors.text}
          />
          <AppText tone={workout.hasKudoed ? 'accent' : 'default'} numeric>
            {workout.kudos}
          </AppText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Comments, ${workout.comments}`}
          onPress={open}
          style={styles.action}
        >
          <Icon name="chatbubble-outline" size={20} />
          <AppText numeric>{workout.comments}</AppText>
        </Pressable>
        <View style={styles.flex} />
        {!workout.verified && workout.distanceM !== null && workout.distanceM > 0 && (
          <AppText variant="caption" tone="muted">
            Not on leaderboards
          </AppText>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  owner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  flex: {
    flex: 1,
  },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xl,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: minTouchTarget,
    paddingRight: spacing.sm,
  },
});

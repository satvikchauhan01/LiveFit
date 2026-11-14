import type { ChallengeKind, ChallengeSummary, LeaderboardRow } from '@shared/api';

import { ACTIVITY_TYPES, type ActivityType } from '@/db/schema';
import { ACTIVITY_DISPLAY } from '@/features/workouts/activities';
import { formatDistance, formatDuration, formatWeight, formatWorkoutDay } from '@/lib/format';
import type { DistanceUnit, WeightUnit } from '@/lib/units';

type Units = { distance: DistanceUnit; weight: WeightUnit };

export const CHALLENGE_KIND_LABEL: Record<ChallengeKind, string> = {
  distance: 'Distance',
  duration: 'Time',
  count: 'Workouts',
  volume: 'Weight lifted',
  hybrid: 'Hybrid',
};

function isActivity(type: string): type is ActivityType {
  return (ACTIVITY_TYPES as readonly string[]).includes(type);
}

/** "Runs and rides", or "Any workout" when no types are picked. */
export function activitiesText(types: string[]): string {
  const words = types.filter(isActivity).map((type) => ACTIVITY_DISPLAY[type].word + 's');
  if (words.length === 0) return 'Any workout';
  const text =
    words.length === 1 ? words[0] : `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** The goal in a few words: "50.00 km", "10 workouts", "20.00 km + 4 strength sessions". */
export function targetText(challenge: ChallengeSummary, units: Units): string {
  switch (challenge.kind) {
    case 'distance':
      return formatDistance(challenge.targetDistanceM ?? 0, units.distance);
    case 'duration':
      return formatDuration((challenge.targetDurationS ?? 0) * 1000);
    case 'count':
      return `${challenge.targetCount ?? 0} workouts`;
    case 'volume':
      return formatWeight(challenge.targetVolumeKg ?? 0, units.weight);
    case 'hybrid':
      return `${formatDistance(challenge.targetDistanceM ?? 0, units.distance)} + ${
        challenge.targetStrengthSessions ?? 0
      } strength sessions`;
  }
}

/** One person's score in the challenge's own terms. */
export function scoreText(kind: ChallengeKind, row: LeaderboardRow, units: Units): string {
  switch (kind) {
    case 'distance':
      return formatDistance(row.distanceM, units.distance);
    case 'duration':
      return formatDuration(row.durationS * 1000);
    case 'count':
      return `${row.count} ${row.count === 1 ? 'workout' : 'workouts'}`;
    case 'volume':
      return formatWeight(row.volumeKg, units.weight);
    case 'hybrid':
      return `${formatDistance(row.distanceM, units.distance)} · ${row.strengthSessions} strength`;
  }
}

/** "Ends Sun 30 Nov", "Starts Mon 1 Dec" or "Ended Fri 14 Nov". */
export function datesText(challenge: ChallengeSummary, now: number): string {
  if (now < challenge.startsAt) {
    return `Starts ${formatWorkoutDay(challenge.startsAt, challenge.timezone)}`;
  }
  // endsAt is the last millisecond of the final day.
  const lastDay = formatWorkoutDay(challenge.endsAt, challenge.timezone);
  return now < challenge.endsAt ? `Ends ${lastDay}` : `Ended ${lastDay}`;
}

import * as Notifications from 'expo-notifications';

import type { Goal, GoalKind } from '@/db/schema';
import { ACTIVITY_DISPLAY } from '@/features/workouts/activities';
import { listWorkouts, type WorkoutListItem } from '@/features/workouts/workoutRepository';
import { weekOf } from '@/features/workouts/weeks';
import { onLocalChange } from '@/features/sync/changes';
import { getAlertPermission } from '@/features/strength/restAlerts';
import { currentWeekKey, localDateTime } from '@/lib/dates';
import { formatDistance, formatDuration, formatWorkoutCount } from '@/lib/format';
import type { DistanceUnit, WeightUnit } from '@/lib/units';
import { fromKg } from '@/lib/units';

import { heaviestLiftKg, listGoals, markGoalAchieved } from './progressRepository';

export const GOAL_KIND_LABEL: Record<GoalKind, string> = {
  workouts_week: 'Workouts per week',
  distance_week: 'Distance per week',
  distance_month: 'Distance per month',
  duration_week: 'Training time per week',
  lift: 'Strength target',
};

export type GoalProgress = {
  current: number;
  target: number;
  /** 0–1 (capped). */
  fraction: number;
  /** Which week/month this progress is for; "lift" goals have one forever. */
  period: string;
  /** "12.4 of 20 km this week". */
  text: string;
};

function monthKeyOf(ms: number, timeZone?: string | null): string {
  const local = localDateTime(ms, timeZone);
  return `${local.year}-${String(local.month).padStart(2, '0')}`;
}

/** How far along a goal is, from the list of finished workouts. */
export function goalProgress(
  goal: Goal,
  workouts: WorkoutListItem[],
  units: { distance: DistanceUnit; weight: WeightUnit },
  liftKg = 0,
  now = Date.now(),
): GoalProgress {
  const thisWeek = currentWeekKey();
  const thisMonth = monthKeyOf(now);
  const cardio = (workout: WorkoutListItem) =>
    workout.type !== 'strength' && (!goal.activityType || workout.type === goal.activityType);
  const scope = goal.activityType
    ? ` (${ACTIVITY_DISPLAY[goal.activityType as keyof typeof ACTIVITY_DISPLAY]?.label ?? goal.activityType})`
    : '';

  let current = 0;
  let period = thisWeek;
  let text = '';
  switch (goal.kind) {
    case 'workouts_week': {
      current = workouts.filter((workout) => weekOf(workout) === thisWeek).length;
      text = `${current} of ${formatWorkoutCount(goal.target)} this week`;
      break;
    }
    case 'distance_week': {
      current = workouts
        .filter((workout) => weekOf(workout) === thisWeek && cardio(workout))
        .reduce((sum, workout) => sum + (workout.distanceM ?? 0), 0);
      text = `${formatDistance(current, units.distance)} of ${formatDistance(goal.target, units.distance)} this week${scope}`;
      break;
    }
    case 'distance_month': {
      period = thisMonth;
      current = workouts
        .filter(
          (workout) =>
            monthKeyOf(workout.startedAt, workout.timezone) === thisMonth && cardio(workout),
        )
        .reduce((sum, workout) => sum + (workout.distanceM ?? 0), 0);
      text = `${formatDistance(current, units.distance)} of ${formatDistance(goal.target, units.distance)} this month${scope}`;
      break;
    }
    case 'duration_week': {
      current = workouts
        .filter((workout) => weekOf(workout) === thisWeek)
        .reduce((sum, workout) => sum + (workout.movingS ?? 0), 0);
      text = `${formatDuration(current * 1000)} of ${formatDuration(goal.target * 1000)} this week`;
      break;
    }
    case 'lift': {
      period = 'lift';
      current = liftKg;
      const show = (kg: number) =>
        `${Math.round(fromKg(kg, units.weight) * 10) / 10} ${units.weight}`;
      text = `Best ${show(current)} of ${show(goal.target)}`;
      break;
    }
  }
  return {
    current,
    target: goal.target,
    fraction: goal.target > 0 ? Math.min(1, current / goal.target) : 0,
    period,
    text,
  };
}

/** Progress for every goal, loading what each needs. */
export async function loadGoalProgress(units: {
  distance: DistanceUnit;
  weight: WeightUnit;
}): Promise<{ goal: Goal; progress: GoalProgress }[]> {
  const [allGoals, workouts] = await Promise.all([listGoals(), listWorkouts()]);
  return Promise.all(
    allGoals.map(async (goal) => ({
      goal,
      progress: goalProgress(
        goal,
        workouts,
        units,
        goal.kind === 'lift' && goal.exerciseId ? await heaviestLiftKg(goal.exerciseId) : 0,
      ),
    })),
  );
}

/**
 * After workouts change, checks every goal and sends a "Goal reached"
 * notification the first time each one is met in a period.
 */
export function startGoalWatcher(getUnits: () => { distance: DistanceUnit; weight: WeightUnit }) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  onLocalChange(() => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(async () => {
      timer = null;
      try {
        for (const { goal, progress } of await loadGoalProgress(getUnits())) {
          if (progress.fraction < 1 || goal.lastAchievedPeriod === progress.period) continue;
          await markGoalAchieved(goal.id, progress.period);
          if ((await getAlertPermission()) === 'granted') {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: 'Goal reached!',
                body: `${GOAL_KIND_LABEL[goal.kind]}: ${progress.text}.`,
              },
              trigger: null,
            });
          }
        }
      } catch (error) {
        console.warn('[goals] check failed', error);
      }
    }, 2_000);
  });
}

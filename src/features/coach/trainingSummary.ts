import type { CoachTrainingSummary } from '@shared/api';

import type { Profile } from '@/db/schema';
import { GOAL_KIND_LABEL, loadGoalProgress } from '@/features/progress/goals';
import { planById } from '@/features/progress/plans';
import { planStatus } from '@/features/progress/planStatus';
import { getActiveEnrollment } from '@/features/progress/progressRepository';
import { getExerciseLogs } from '@/features/strength/strengthRepository';
import { weekOf } from '@/features/workouts/weeks';
import { listWorkouts } from '@/features/workouts/workoutRepository';
import { addDays, currentWeekKey, localDateTime, toDateKey } from '@/lib/dates';

const WEEKS = 8;
const RECENT = 15;

/**
 * What the coach is told about your training: weekly totals, recent workouts
 * and goals. Numbers and names only. Routes, places and times of day are never
 * included, so nothing sent reveals where you were.
 */
export async function buildTrainingSummary(profile: Profile): Promise<CoachTrainingSummary> {
  const thisWeek = currentWeekKey();
  const firstWeek = addDays(thisWeek, -7 * (WEEKS - 1));
  const workouts = await listWorkouts({ fromMs: Date.now() - (WEEKS * 7 + 1) * 86_400_000 });

  const weeks: CoachTrainingSummary['weeks'] = [];
  for (let index = 0; index < WEEKS; index++) {
    const weekStart = addDays(thisWeek, -7 * index);
    const inWeek = workouts.filter((workout) => weekOf(workout) === weekStart);
    weeks.push({
      weekStart,
      workouts: inWeek.length,
      distanceM: Math.round(inWeek.reduce((sum, workout) => sum + (workout.distanceM ?? 0), 0)),
      movingS: Math.round(inWeek.reduce((sum, workout) => sum + (workout.movingS ?? 0), 0)),
      volumeKg: Math.round(inWeek.reduce((sum, workout) => sum + (workout.volumeKg ?? 0), 0)),
    });
  }

  const recent = await Promise.all(
    workouts
      .filter((workout) => weekOf(workout) >= firstWeek)
      .slice(0, RECENT)
      .map(async (workout) => {
        const local = localDateTime(workout.startedAt, workout.timezone);
        const exercises =
          workout.type === 'strength'
            ? (await getExerciseLogs(workout.id)).map(
                (log) =>
                  `${log.exercise.name}: ${log.sets
                    .map((set) =>
                      set.durationS
                        ? `${set.durationS}s`
                        : `${set.reps ?? '?'}${set.weightKg ? `×${set.weightKg}kg` : ''}`,
                    )
                    .join(', ')}`,
              )
            : [];
        return {
          date: toDateKey(local.year, local.month, local.day),
          type: workout.type,
          title: workout.title.slice(0, 80),
          distanceM: workout.distanceM !== null ? Math.round(workout.distanceM) : null,
          movingS: workout.movingS,
          volumeKg: workout.volumeKg !== null ? Math.round(workout.volumeKg) : null,
          elevationGainM:
            workout.elevationGainM !== null ? Math.round(workout.elevationGainM) : null,
          exercises: exercises.slice(0, 20).map((line) => line.slice(0, 80)),
        };
      }),
  );

  const units = { distance: profile.distanceUnit, weight: profile.weightUnit };
  const goals = (await loadGoalProgress(units))
    .slice(0, 10)
    .map(({ goal, progress }) => `${GOAL_KIND_LABEL[goal.kind]}: ${progress.text}`.slice(0, 120));

  const enrollment = await getActiveEnrollment();
  let plan: string | null = null;
  if (enrollment) {
    const status = planStatus(enrollment, workouts);
    const name = planById(enrollment.planId)?.name;
    if (name && status) {
      plan = status.finished
        ? `${name} (finished)`
        : `${name}, week ${status.weekIndex + 1} of ${status.plan.weeks.length}`;
    }
  }

  return { units, weeklyGoal: profile.weeklyGoal, weeks, recent, goals, plan };
}

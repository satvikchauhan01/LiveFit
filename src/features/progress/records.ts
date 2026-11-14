import { BEST_EFFORT_DISTANCES, type BestEfforts } from '@/features/tracking/bestEfforts';
import type { WorkoutListItem } from '@/features/workouts/workoutRepository';

import type { LiftedSet } from './progressRepository';
import { estimatedOneRepMax } from './strengthMath';

export type CardioRecord = { valueM: number; workoutId: string; startedAt: number };
export type EffortRecord = { distanceM: number; ms: number; workoutId: string; startedAt: number };
export type LiftRecord = {
  exerciseId: string;
  name: string;
  heaviestKg: number;
  heaviestReps: number;
  bestOneRepMaxKg: number | null;
  workoutId: string;
  startedAt: number;
};

export function bestEffortsOf(workout: Pick<WorkoutListItem, 'extras'>): BestEfforts {
  try {
    const extras = JSON.parse(workout.extras) as { bestEfforts?: BestEfforts };
    return extras.bestEfforts ?? {};
  } catch {
    return {};
  }
}

/** Fastest 1 km, 5 km, 10 km and half marathon across all runs. */
export function effortRecords(workouts: WorkoutListItem[]): EffortRecord[] {
  return BEST_EFFORT_DISTANCES.flatMap((distanceM) => {
    let best: EffortRecord | null = null;
    for (const workout of workouts) {
      if (workout.type !== 'run') continue;
      const ms = bestEffortsOf(workout)[String(distanceM)];
      if (ms && (!best || ms < best.ms)) {
        best = { distanceM, ms, workoutId: workout.id, startedAt: workout.startedAt };
      }
    }
    return best ? [best] : [];
  });
}

/** Longest distance in one workout, per activity. */
export function longestByType(workouts: WorkoutListItem[]): Map<string, CardioRecord> {
  const records = new Map<string, CardioRecord>();
  for (const workout of workouts) {
    if (!workout.distanceM || workout.type === 'strength') continue;
    const current = records.get(workout.type);
    if (!current || workout.distanceM > current.valueM) {
      records.set(workout.type, {
        valueM: workout.distanceM,
        workoutId: workout.id,
        startedAt: workout.startedAt,
      });
    }
  }
  return records;
}

export function mostClimb(workouts: WorkoutListItem[]): CardioRecord | null {
  let best: CardioRecord | null = null;
  for (const workout of workouts) {
    const climb = workout.elevationGainM ?? 0;
    if (climb > 0 && (!best || climb > best.valueM)) {
      best = { valueM: climb, workoutId: workout.id, startedAt: workout.startedAt };
    }
  }
  return best;
}

/** Heaviest set and best estimated 1RM, per exercise. */
export function liftRecords(sets: LiftedSet[]): LiftRecord[] {
  const byExercise = new Map<string, LiftRecord>();
  for (const set of sets) {
    const oneRm = estimatedOneRepMax(set.weightKg, set.reps);
    const current = byExercise.get(set.exerciseId);
    if (!current) {
      byExercise.set(set.exerciseId, {
        exerciseId: set.exerciseId,
        name: set.exerciseName,
        heaviestKg: set.weightKg,
        heaviestReps: set.reps,
        bestOneRepMaxKg: oneRm,
        workoutId: set.workoutId,
        startedAt: set.startedAt,
      });
      continue;
    }
    if (set.weightKg > current.heaviestKg) {
      Object.assign(current, {
        heaviestKg: set.weightKg,
        heaviestReps: set.reps,
        workoutId: set.workoutId,
        startedAt: set.startedAt,
      });
    }
    if (oneRm !== null && (current.bestOneRepMaxKg === null || oneRm > current.bestOneRepMaxKg)) {
      current.bestOneRepMaxKg = oneRm;
    }
  }
  return [...byExercise.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Records set by one workout, for the celebration on its summary: compares it
 * against every other workout. Returns short phrases ("Fastest 5 km", "Longest run").
 */
export function newRecordsIn(
  workoutId: string,
  workouts: WorkoutListItem[],
  sets: LiftedSet[],
): string[] {
  const found: string[] = [];
  const workout = workouts.find((item) => item.id === workoutId);
  if (!workout) return found;
  const others = workouts.filter((item) => item.id !== workoutId);

  if (workout.type === 'run') {
    const mine = bestEffortsOf(workout);
    for (const record of effortRecords([workout])) {
      const previous = effortRecords(others).find((item) => item.distanceM === record.distanceM);
      if (!previous || mine[String(record.distanceM)] < previous.ms) {
        found.push(
          `Fastest ${record.distanceM === 21_097.5 ? 'half marathon' : `${record.distanceM / 1000} km`}`,
        );
      }
    }
  }
  if (workout.distanceM && workout.type !== 'strength') {
    const previous = longestByType(others).get(workout.type);
    if (previous && workout.distanceM > previous.valueM)
      found.push(`Longest ${workout.type === 'cycle' ? 'ride' : workout.type}`);
  }
  if (workout.type === 'strength') {
    const mineSets = sets.filter((set) => set.workoutId === workoutId);
    const before = liftRecords(sets.filter((set) => set.workoutId !== workoutId));
    for (const record of liftRecords(mineSets)) {
      const previous = before.find((item) => item.exerciseId === record.exerciseId);
      if (previous && record.heaviestKg > previous.heaviestKg) {
        found.push(`Heaviest ${record.name}`);
      }
    }
  }
  return found;
}

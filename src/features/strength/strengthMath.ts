import type { LogType, StrengthSet } from '@/db/schema';

import type { ExerciseLog } from './strengthRepository';

type VolumeSet = Pick<StrengthSet, 'reps' | 'weightKg' | 'completedAt'>;

/** Weight × reps for a completed weighted set; 0 for anything else. */
export function setVolumeKg(set: VolumeSet, logType: LogType): number {
  if (logType !== 'weight_reps' || set.completedAt === null) {
    return 0;
  }
  return (set.reps ?? 0) * (set.weightKg ?? 0);
}

export type SessionTotals = {
  /** Exercises with at least one completed set. */
  exercises: number;
  /** Completed sets. */
  sets: number;
  volumeKg: number;
};

export function sessionTotals(
  logs: (Pick<ExerciseLog, 'exercise'> & { sets: VolumeSet[] })[],
): SessionTotals {
  let exercises = 0;
  let sets = 0;
  let volumeKg = 0;
  for (const log of logs) {
    const done = log.sets.filter((set) => set.completedAt !== null);
    if (done.length > 0) exercises += 1;
    sets += done.length;
    for (const set of done) {
      volumeKg += setVolumeKg(set, log.exercise.logType);
    }
  }
  return { exercises, sets, volumeKg };
}

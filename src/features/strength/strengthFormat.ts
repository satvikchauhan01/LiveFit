import type { LogType } from '@/db/schema';
import { formatDuration } from '@/lib/format';
import { fromKg, type WeightUnit } from '@/lib/units';

import type { SetValues } from './strengthRepository';

/** A load in the user's unit, without trailing zeros: 60 → "60", 62.5 → "62.5". */
export function formatLoad(kg: number, unit: WeightUnit): string {
  return String(Math.round(fromKg(kg, unit) * 10) / 10);
}

/** 4320 kg → "4,320 kg" (or the same in lb). */
export function formatVolume(kg: number, unit: WeightUnit): string {
  const value = Math.round(fromKg(kg, unit));
  return `${value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')} ${unit}`;
}

/** 45 → "0:45", 90 → "1:30". */
export function formatSeconds(seconds: number): string {
  return formatDuration(seconds * 1000);
}

/** One set: "60 kg × 8", "12 reps" or "0:45". */
export function formatSet(set: SetValues, logType: LogType, unit: WeightUnit): string {
  switch (logType) {
    case 'weight_reps':
      return `${formatLoad(set.weightKg ?? 0, unit)} ${unit} × ${set.reps ?? 0}`;
    case 'reps':
      return `${set.reps ?? 0} reps`;
    case 'time':
      return formatSeconds(set.durationS ?? 0);
  }
}

function allSame<T>(values: T[]): boolean {
  return values.every((value) => value === values[0]);
}

/**
 * A whole session of one exercise, as short as it can be said:
 * "3 × 8 @ 60 kg", "8, 8, 6 @ 60 kg", "60 kg × 8, 55 kg × 8", "3 × 12", "2 × 0:45".
 */
export function formatSetsSummary(sets: SetValues[], logType: LogType, unit: WeightUnit): string {
  if (sets.length === 0) return '';
  const count = sets.length;

  switch (logType) {
    case 'weight_reps': {
      const loads = sets.map((set) => formatLoad(set.weightKg ?? 0, unit));
      const reps = sets.map((set) => set.reps ?? 0);
      if (allSame(loads) && allSame(reps)) return `${count} × ${reps[0]} @ ${loads[0]} ${unit}`;
      if (allSame(loads)) return `${reps.join(', ')} @ ${loads[0]} ${unit}`;
      return sets.map((set) => formatSet(set, logType, unit)).join(', ');
    }
    case 'reps': {
      const reps = sets.map((set) => set.reps ?? 0);
      return allSame(reps) ? `${count} × ${reps[0]}` : reps.join(', ');
    }
    case 'time': {
      const times = sets.map((set) => formatSeconds(set.durationS ?? 0));
      return allSame(times) ? `${count} × ${times[0]}` : times.join(', ');
    }
  }
}

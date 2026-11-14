import type { LogType, StrengthSet } from '@/db/schema';
import { toKg, type WeightUnit } from '@/lib/units';

import type { SetValues } from './strengthRepository';
import { formatLoad } from './strengthFormat';

// Turning what's typed into a set row into numbers, and back.

export type SetInput = {
  /** In the user's weight unit. */
  load: string;
  reps: string;
  /** Seconds, or minutes:seconds. */
  time: string;
};

export type SetField = keyof SetInput;

const MAX_LOAD_KG = 1000;
const MAX_REPS = 999;
const MAX_SECONDS = 3600;

/** Whole reps, 1 to 999. */
export function parseReps(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const reps = Number(trimmed);
  return reps >= 1 && reps <= MAX_REPS ? reps : null;
}

/** A load in the user's unit (a comma works as the decimal point), returned in kg. */
export function parseLoad(text: string, unit: WeightUnit): number | null {
  const trimmed = text.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  const kg = toKg(Number(trimmed), unit);
  return kg <= MAX_LOAD_KG ? kg : null;
}

/** "45" → 45 seconds, "1:30" → 90 seconds. */
export function parseSeconds(text: string): number | null {
  const trimmed = text.trim();
  let seconds: number;
  if (/^\d+$/.test(trimmed)) {
    seconds = Number(trimmed);
  } else {
    const match = /^(\d+):([0-5]\d)$/.exec(trimmed);
    if (!match) return null;
    seconds = Number(match[1]) * 60 + Number(match[2]);
  }
  return seconds >= 1 && seconds <= MAX_SECONDS ? seconds : null;
}

export type ParsedSet = { ok: true; values: SetValues } | { ok: false; invalid: SetField[] };

/** Reads the fields that matter for this kind of exercise; the others are ignored. */
export function parseSetInput(input: SetInput, logType: LogType, unit: WeightUnit): ParsedSet {
  const invalid: SetField[] = [];
  const values: SetValues = { reps: null, weightKg: null, durationS: null };

  if (logType === 'weight_reps') {
    values.weightKg = parseLoad(input.load, unit);
    if (values.weightKg === null) invalid.push('load');
  }
  if (logType === 'weight_reps' || logType === 'reps') {
    values.reps = parseReps(input.reps);
    if (values.reps === null) invalid.push('reps');
  }
  if (logType === 'time') {
    values.durationS = parseSeconds(input.time);
    if (values.durationS === null) invalid.push('time');
  }

  return invalid.length > 0 ? { ok: false, invalid } : { ok: true, values };
}

/** The text a set row starts with. */
export function inputFromSet(
  set: Pick<StrengthSet, 'reps' | 'weightKg' | 'durationS'>,
  unit: WeightUnit,
): SetInput {
  return {
    load: set.weightKg !== null ? formatLoad(set.weightKg, unit) : '',
    reps: set.reps !== null ? String(set.reps) : '',
    time: set.durationS !== null ? String(set.durationS) : '',
  };
}

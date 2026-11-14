import { describe, expect, it } from '@jest/globals';

import type { Exercise, LogType } from '@/db/schema';

import { BUILT_IN_EXERCISES } from './builtInExercises';
import { searchExercises } from './exerciseSearch';
import { inputFromSet, parseLoad, parseReps, parseSeconds, parseSetInput } from './setInput';
import { formatLoad, formatSet, formatSetsSummary, formatVolume } from './strengthFormat';
import { sessionTotals, setVolumeKg } from './strengthMath';

const set = (weightKg: number | null, reps: number | null, durationS: number | null = null) => ({
  weightKg,
  reps,
  durationS,
});

describe('built-in exercises', () => {
  it('has unique ids and names', () => {
    const ids = BUILT_IN_EXERCISES.map((exercise) => exercise.id);
    const names = BUILT_IN_EXERCISES.map((exercise) => exercise.name.toLowerCase());
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(names).size).toBe(names.length);
    expect(BUILT_IN_EXERCISES.length).toBeGreaterThanOrEqual(40);
  });

  it('logs bodyweight moves without a weight', () => {
    const pushUp = BUILT_IN_EXERCISES.find((exercise) => exercise.id === 'push-up');
    const plank = BUILT_IN_EXERCISES.find((exercise) => exercise.id === 'plank');
    expect(pushUp?.logType).toBe('reps');
    expect(plank?.logType).toBe('time');
  });
});

describe('parsing set inputs', () => {
  it('reads whole reps', () => {
    expect(parseReps('8')).toBe(8);
    expect(parseReps(' 12 ')).toBe(12);
    expect(parseReps('0')).toBeNull();
    expect(parseReps('7.5')).toBeNull();
    expect(parseReps('')).toBeNull();
  });

  it('reads loads in kg or lb and stores kg', () => {
    expect(parseLoad('60', 'kg')).toBe(60);
    expect(parseLoad('62,5', 'kg')).toBe(62.5); // comma as decimal point
    expect(parseLoad('0', 'kg')).toBe(0); // e.g. an empty machine
    expect(parseLoad('135', 'lb')).toBeCloseTo(61.235, 3);
    expect(parseLoad('abc', 'kg')).toBeNull();
    expect(parseLoad('1500', 'kg')).toBeNull();
  });

  it('reads durations as seconds or minutes:seconds', () => {
    expect(parseSeconds('45')).toBe(45);
    expect(parseSeconds('1:30')).toBe(90);
    expect(parseSeconds('1:5')).toBeNull();
    expect(parseSeconds('0')).toBeNull();
  });

  it('only checks the fields the exercise uses', () => {
    const input = { load: '', reps: '10', time: '' };
    expect(parseSetInput(input, 'reps', 'kg')).toEqual({
      ok: true,
      values: { reps: 10, weightKg: null, durationS: null },
    });
    expect(parseSetInput(input, 'weight_reps', 'kg')).toEqual({ ok: false, invalid: ['load'] });
    expect(parseSetInput(input, 'time', 'kg')).toEqual({ ok: false, invalid: ['time'] });
  });

  it('round-trips a pound load without drifting', () => {
    const kg = parseLoad('135', 'lb') ?? 0;
    expect(inputFromSet(set(kg, 5), 'lb').load).toBe('135');
  });
});

describe('formatting', () => {
  it('shows loads without trailing zeros', () => {
    expect(formatLoad(60, 'kg')).toBe('60');
    expect(formatLoad(62.5, 'kg')).toBe('62.5');
    expect(formatLoad(61.2349, 'lb')).toBe('135');
  });

  it('formats volume with thousands separators', () => {
    expect(formatVolume(4320, 'kg')).toBe('4,320 kg');
    expect(formatVolume(1234567, 'kg')).toBe('1,234,567 kg');
    expect(formatVolume(0, 'lb')).toBe('0 lb');
  });

  it('formats single sets', () => {
    expect(formatSet(set(60, 8), 'weight_reps', 'kg')).toBe('60 kg × 8');
    expect(formatSet(set(null, 12), 'reps', 'kg')).toBe('12 reps');
    expect(formatSet(set(null, null, 45), 'time', 'kg')).toBe('0:45');
  });

  it('says a session as briefly as possible', () => {
    const summary = (sets: ReturnType<typeof set>[], logType: LogType) =>
      formatSetsSummary(sets, logType, 'kg');

    expect(summary([set(60, 8), set(60, 8), set(60, 8)], 'weight_reps')).toBe('3 × 8 @ 60 kg');
    expect(summary([set(60, 8), set(60, 8), set(60, 6)], 'weight_reps')).toBe('8, 8, 6 @ 60 kg');
    expect(summary([set(60, 8), set(55, 8)], 'weight_reps')).toBe('60 kg × 8, 55 kg × 8');
    expect(summary([set(null, 12), set(null, 12)], 'reps')).toBe('2 × 12');
    expect(summary([set(null, 12), set(null, 10)], 'reps')).toBe('12, 10');
    expect(summary([set(null, null, 45), set(null, null, 45)], 'time')).toBe('2 × 0:45');
    expect(summary([], 'reps')).toBe('');
  });
});

describe('volume', () => {
  const done = { completedAt: 1 };
  const open = { completedAt: null };

  it('counts weight × reps of completed weighted sets only', () => {
    expect(setVolumeKg({ ...set(60, 8), ...done }, 'weight_reps')).toBe(480);
    expect(setVolumeKg({ ...set(60, 8), ...open }, 'weight_reps')).toBe(0);
    expect(setVolumeKg({ ...set(null, 20), ...done }, 'reps')).toBe(0);
  });

  it('adds up a session', () => {
    const exercise = (logType: LogType) => ({ exercise: { logType } as Exercise });
    const totals = sessionTotals([
      {
        ...exercise('weight_reps'),
        sets: [
          { ...set(100, 5), ...done },
          { ...set(100, 5), ...done },
          { ...set(100, 5), ...open },
        ],
      },
      { ...exercise('reps'), sets: [{ ...set(null, 15), ...done }] },
      { ...exercise('time'), sets: [{ ...set(null, null, 60), ...open }] },
    ]);

    expect(totals).toEqual({ exercises: 2, sets: 3, volumeKg: 1000 });
  });
});

describe('searchExercises', () => {
  const all = BUILT_IN_EXERCISES.map((exercise) => ({
    ...exercise,
    isCustom: false,
    createdAt: 0,
  }));

  it('matches every word typed, in any order, ignoring case', () => {
    const names = searchExercises(all, 'PRESS bench').flatMap((section) =>
      section.data.map((exercise) => exercise.name),
    );
    expect(names).toEqual(['Bench Press', 'Dumbbell Bench Press', 'Incline Bench Press']);
  });

  it('groups by muscle group in a fixed order', () => {
    const titles = searchExercises(all, 'curl').map((section) => section.title);
    expect(titles).toEqual(['Legs', 'Arms']); // Leg Curl, then the arm curls
  });

  it('shows everything for an empty search', () => {
    const count = searchExercises(all, '  ').reduce((sum, section) => sum + section.data.length, 0);
    expect(count).toBe(all.length);
  });
});

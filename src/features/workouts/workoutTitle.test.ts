import { describe, expect, it } from '@jest/globals';

import { defaultWorkoutTitle } from './workoutTitle';

const at = (hour: number, minute = 0) => new Date(2026, 10, 13, hour, minute).getTime();

describe('defaultWorkoutTitle', () => {
  it('names the workout after the time of day it started', () => {
    expect(defaultWorkoutTitle('run', at(7))).toBe('Morning run');
    expect(defaultWorkoutTitle('run', at(13))).toBe('Afternoon run');
    expect(defaultWorkoutTitle('walk', at(18, 30))).toBe('Evening walk');
    expect(defaultWorkoutTitle('run', at(23))).toBe('Night run');
    expect(defaultWorkoutTitle('walk', at(4, 59))).toBe('Night walk');
  });
});

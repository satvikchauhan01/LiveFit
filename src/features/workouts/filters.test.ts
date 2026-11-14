import { describe, expect, it } from '@jest/globals';

import { rangeStart, toWorkoutFilter } from './filters';

// Local dates, so these pass in any time zone.
const friday = new Date(2026, 10, 13, 15, 0);

describe('rangeStart', () => {
  it('has no start for "All time"', () => {
    expect(rangeStart('all', friday)).toBeUndefined();
  });

  it('covers this week and the three before it', () => {
    expect(rangeStart('4w', friday)).toBe(new Date(2026, 9, 19).getTime()); // Monday 19 Oct
  });

  it('covers this month and the two before it, across a new year', () => {
    expect(rangeStart('3m', friday)).toBe(new Date(2026, 8, 1).getTime());
    expect(rangeStart('3m', new Date(2027, 0, 15))).toBe(new Date(2026, 10, 1).getTime());
  });

  it('starts "This year" on 1 January', () => {
    expect(rangeStart('year', friday)).toBe(new Date(2026, 0, 1).getTime());
  });
});

describe('toWorkoutFilter', () => {
  it('turns the chips into a database filter', () => {
    expect(toWorkoutFilter('all', 'all')).toEqual({ types: undefined, fromMs: undefined });
    expect(toWorkoutFilter('walk', 'all')).toEqual({ types: ['walk'], fromMs: undefined });
  });
});

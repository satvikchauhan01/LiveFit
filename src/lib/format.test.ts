import { describe, expect, it } from '@jest/globals';

import {
  formatDistance,
  formatDuration,
  formatPace,
  formatPaceValue,
  formatTotals,
} from './format';
import { METERS_PER_MILE } from './units';

describe('formatDuration', () => {
  it('shows minutes and seconds, and hours only when needed', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(75_000)).toBe('1:15');
    expect(formatDuration(3_725_000)).toBe('1:02:05');
    expect(formatDuration(-5_000)).toBe('0:00');
  });
});

describe('formatDistance', () => {
  it('converts metres to the chosen unit', () => {
    expect(formatDistance(1234, 'km')).toBe('1.23 km');
    expect(formatDistance(METERS_PER_MILE, 'mi')).toBe('1.00 mi');
  });
});

describe('formatTotals', () => {
  it('summarises a group of workouts', () => {
    expect(formatTotals({ count: 1, distanceM: 5000, movingS: 1500 }, 'km')).toBe(
      '1 workout · 5.00 km · 25:00',
    );
    expect(formatTotals({ count: 3, distanceM: 12_400, movingS: 3912 }, 'km')).toBe(
      '3 workouts · 12.40 km · 1:05:12',
    );
    // Strength-only weeks have no distance to show.
    expect(formatTotals({ count: 2, distanceM: 0, movingS: 4500 }, 'km')).toBe(
      '2 workouts · 1:15:00',
    );
  });
});

describe('formatPace', () => {
  it('formats seconds per km, converting for miles', () => {
    expect(formatPace(300, 'km')).toBe('5:00 /km');
    expect(formatPace(300, 'mi')).toBe('8:03 /mi'); // 300 × 1.609344 ≈ 483 s
    expect(formatPace(null, 'km')).toBe('–');
  });

  it('rounds to whole seconds before splitting into minutes', () => {
    expect(formatPaceValue(299.6, 'km')).toBe('5:00'); // not "4:60"
  });
});

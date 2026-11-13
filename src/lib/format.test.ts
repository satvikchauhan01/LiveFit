import { describe, expect, it } from '@jest/globals';

import { formatDistance, formatDuration, formatPace, formatPaceValue } from './format';
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

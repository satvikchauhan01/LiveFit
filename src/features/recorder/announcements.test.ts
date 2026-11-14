import { describe, expect, it } from '@jest/globals';

import type { Split } from '@/features/tracking/splits';

import {
  lapAnnouncement,
  splitAnnouncement,
  spokenDistance,
  spokenDuration,
} from './announcements';

const split = (index: number, distanceM: number, durationMs: number): Split => ({
  index,
  distanceM,
  durationMs,
  paceSecPerKm: null,
  partial: false,
});

describe('spokenDuration', () => {
  it('reads times the way people say them', () => {
    expect(spokenDuration(312_000)).toBe('5 minutes 12 seconds');
    expect(spokenDuration(61_000)).toBe('1 minute 1 second');
    expect(spokenDuration(45_000)).toBe('45 seconds');
    expect(spokenDuration(3_725_000)).toBe('1 hour 2 minutes 5 seconds');
    expect(spokenDuration(3_600_000)).toBe('1 hour');
    expect(spokenDuration(0)).toBe('0 seconds');
  });
});

describe('spokenDistance', () => {
  it('uses metres under a kilometre, otherwise km or miles', () => {
    expect(spokenDistance(400, 'km')).toBe('400 metres');
    expect(spokenDistance(2500, 'km')).toBe('2.5 kilometres');
    expect(spokenDistance(1000, 'km')).toBe('1 kilometre');
    expect(spokenDistance(1609.344, 'mi')).toBe('1 mile');
    expect(spokenDistance(400, 'mi')).toBe('0.25 miles');
  });
});

describe('announcements', () => {
  it('announces each kilometre or mile', () => {
    expect(splitAnnouncement(split(2, 1000, 310_000), 'km', 624_000)).toBe(
      '2 kilometres. Time 10 minutes 24 seconds. Last kilometre 5 minutes 10 seconds.',
    );
    expect(splitAnnouncement(split(1, 1609.344, 560_000), 'mi', 560_000)).toBe(
      '1 mile. Time 9 minutes 20 seconds. Last mile 9 minutes 20 seconds.',
    );
  });

  it('announces laps', () => {
    expect(lapAnnouncement(split(2, 400, 92_000), 'km')).toBe(
      'Lap 2. 400 metres in 1 minute 32 seconds.',
    );
  });
});

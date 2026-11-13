import { describe, expect, it } from '@jest/globals';

import { activeMsAt, isPausedAt, openPause, pausedMsBetween } from './pauses';

const pauses = [
  { startedAt: 10_000, endedAt: 20_000 },
  { startedAt: 50_000, endedAt: null }, // still paused
];

describe('pauses', () => {
  it('treats the start of a pause as paused and its end as recording again', () => {
    expect(isPausedAt(9_999, pauses)).toBe(false);
    expect(isPausedAt(10_000, pauses)).toBe(true);
    expect(isPausedAt(19_999, pauses)).toBe(true);
    expect(isPausedAt(20_000, pauses)).toBe(false);
    expect(isPausedAt(1_000_000, pauses)).toBe(true); // the open pause has no end yet
  });

  it('measures only the paused part of a time range', () => {
    expect(pausedMsBetween(0, 15_000, pauses)).toBe(5_000);
    expect(pausedMsBetween(0, 60_000, pauses)).toBe(10_000 + 10_000);
    expect(pausedMsBetween(25_000, 45_000, pauses)).toBe(0);
  });

  it('subtracts pauses from recording time', () => {
    expect(activeMsAt(30_000, 0, pauses)).toBe(20_000);
    expect(activeMsAt(70_000, 0, pauses)).toBe(40_000); // stopped growing at 50 s
  });

  it('finds the pause that is still open', () => {
    expect(openPause(pauses)).toBe(pauses[1]);
    expect(openPause([pauses[0]])).toBeUndefined();
  });
});

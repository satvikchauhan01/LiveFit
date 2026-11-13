import { describe, expect, it } from '@jest/globals';

import { METERS_PER_MILE } from '@/lib/units';

import { straightLine, T0 } from './__fixtures__/trackBuilder';
import { analyzeTrack } from './pipeline';
import { computeSplits, splitsForSummary } from './splits';
import type { PauseInterval, TrackPoint } from './types';

function analyze(points: TrackPoint[], pauses: PauseInterval[] = []) {
  return analyzeTrack({
    activity: 'run',
    startedAt: T0,
    endAt: points[points.length - 1].t,
    points,
    pauses,
  });
}

describe('computeSplits', () => {
  it('cuts a steady run into equal kilometre splits', () => {
    const track = analyze(straightLine(625, 4)); // 2500 m

    const { completed, current } = computeSplits(track, 1000);

    expect(completed).toHaveLength(2);
    expect(completed[0].durationMs).toBeCloseTo(250_000, 3);
    expect(completed[1].durationMs).toBeCloseTo(250_000, 3);
    expect(completed[0].paceSecPerKm).toBeCloseTo(250, 6);
    expect(current.index).toBe(3);
    expect(current.partial).toBe(true);
    expect(current.distanceM).toBeCloseTo(500, 6);
    expect(current.durationMs).toBeCloseTo(125_000, 3);
  });

  it('interpolates the moment a boundary is crossed between two fixes', () => {
    // At 3 m/s the 1000 m mark falls a third of the way between the fixes at 333 s and 334 s.
    const track = analyze(straightLine(400, 3));

    const { completed } = computeSplits(track, 1000);

    expect(completed[0].durationMs).toBeCloseTo(333_333.33, 1);
  });

  it('works in miles', () => {
    const track = analyze(straightLine(425, 4)); // 1700 m

    const { completed, current } = computeSplits(track, METERS_PER_MILE);

    expect(completed).toHaveLength(1);
    expect(completed[0].durationMs).toBeCloseTo((METERS_PER_MILE / 4) * 1000, 3);
    expect(current.distanceM).toBeCloseTo(1700 - METERS_PER_MILE, 6);
  });

  it('leaves pauses out of split times', () => {
    const track = analyze(straightLine(400, 4), [
      { startedAt: T0 + 100_000, endedAt: T0 + 160_000 },
    ]);

    const { completed } = computeSplits(track, 1000);

    // 396 m by the pause; 604 m more after resuming at 160 s takes 151 s (until 311 s).
    // Recording time at 311 s is 311 − 60 = 251 s.
    expect(completed[0].durationMs).toBeCloseTo(251_000, 3);
  });

  it('adds the split durations up to the moving time', () => {
    const track = analyze(straightLine(777, 3.1));

    const { completed, current } = computeSplits(track, 1000);
    const total = [...completed, current].reduce((sum, split) => sum + split.durationMs, 0);

    expect(total).toBeCloseTo(track.movingMs, 3);
  });
});

describe('splitsForSummary', () => {
  it('drops a leftover too short to matter', () => {
    const track = analyze(straightLine(401, 5)); // 2005 m
    expect(splitsForSummary(computeSplits(track, 1000))).toHaveLength(2);
  });

  it('keeps a real partial last split', () => {
    const track = analyze(straightLine(410, 5)); // 2050 m
    const splits = splitsForSummary(computeSplits(track, 1000));

    expect(splits).toHaveLength(3);
    expect(splits[2].partial).toBe(true);
    expect(splits[2].distanceM).toBeCloseTo(50, 6);
  });
});

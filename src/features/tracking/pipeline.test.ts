import { describe, expect, it } from '@jest/globals';

import { shiftEast, straightLine, T0, trackFromSpeeds } from './__fixtures__/trackBuilder';
import { analyzeTrack, currentPaceSecPerKm, smooth, type TrackInput } from './pipeline';
import type { TrackPoint } from './types';

function analyze(points: TrackPoint[], overrides: Partial<TrackInput> = {}) {
  return analyzeTrack({
    activity: 'run',
    startedAt: T0,
    endAt: points[points.length - 1].t,
    points,
    pauses: [],
    ...overrides,
  });
}

describe('analyzeTrack', () => {
  it('measures a clean straight line exactly', () => {
    const track = analyze(straightLine(250, 4)); // 4 m/s for 250 s = 1000 m

    expect(track.distanceM).toBeCloseTo(1000, 6);
    expect(track.movingMs).toBe(250_000);
    expect(track.elapsedMs).toBe(250_000);
    expect(track.averagePaceSecPerKm).toBeCloseTo(250, 6);
    expect(track.segments).toHaveLength(1);
  });

  it('drops fixes with a poor accuracy radius', () => {
    const points = straightLine(100, 3);
    points[50] = { ...shiftEast(points[50], 40), accuracy: 40 };

    const track = analyze(points);

    expect(track.diagnostics.dropped.inaccurate).toBe(1);
    expect(track.distanceM).toBeCloseTo(300, 6);
  });

  it('drops jumps that are too fast for the activity', () => {
    const points = straightLine(100, 3);
    points[60] = shiftEast(points[60], 200); // 200 m sideways in one second

    const track = analyze(points);

    expect(track.diagnostics.dropped.tooFast).toBe(1);
    expect(track.distanceM).toBeCloseTo(300, 6);
  });

  it('uses a lower speed limit for walks than for runs', () => {
    const fast = straightLine(60, 8); // 8 m/s: a sprint, not a walk

    expect(analyze(fast).diagnostics.dropped.tooFast).toBe(0);
    expect(analyze(fast, { activity: 'walk' }).diagnostics.dropped.tooFast).toBeGreaterThan(0);
  });

  it('drops repeated and out-of-order timestamps', () => {
    const points = straightLine(10, 3);
    const withRepeat = [...points.slice(0, 6), { ...points[3] }, ...points.slice(6)];

    const track = analyze(withRepeat);

    expect(track.diagnostics.dropped.outOfOrder).toBe(1);
    expect(track.distanceM).toBeCloseTo(30, 6);
  });

  it('ignores fixes from before the start or after the end', () => {
    const points = straightLine(100, 3);

    const track = analyze(points, { startedAt: T0 + 10_000, endAt: T0 + 60_000 });

    expect(track.diagnostics.dropped.outsideWorkout).toBe(10 + 40);
    expect(track.distanceM).toBeCloseTo(150, 6);
    expect(track.movingMs).toBe(50_000);
  });

  it('leaves out the time and distance of a pause', () => {
    const points = straightLine(300, 4); // keeps moving through the pause
    const pauses = [{ startedAt: T0 + 100_000, endedAt: T0 + 160_000 }];

    const track = analyze(points, { pauses });

    expect(track.elapsedMs).toBe(300_000);
    expect(track.movingMs).toBe(240_000);
    expect(track.segments).toHaveLength(2);
    expect(track.diagnostics.dropped.paused).toBe(60);
    // Nothing counts between the last fix before the pause (99 s)
    // and the first fix after it (160 s): 61 s × 4 m/s.
    expect(track.distanceM).toBeCloseTo(1200 - 61 * 4, 6);
  });

  it('starts a new segment after a pause even if no fixes arrived during it', () => {
    // GPS stopped for 20 s (e.g. the app was killed), and recovery paused from the last fix.
    const points = straightLine(100, 3).filter((p) => p.t < T0 + 40_000 || p.t >= T0 + 60_000);
    const pauses = [{ startedAt: T0 + 39_500, endedAt: T0 + 60_000 }];

    const track = analyze(points, { pauses });

    expect(track.segments).toHaveLength(2);
    expect(track.distanceM).toBeCloseTo(39 * 3 + 40 * 3, 6);
  });

  it('smooths out zig-zag without shortening a straight path', () => {
    // ±2 m of sideways wobble on every fix, like a noisy GPS.
    const points = straightLine(200, 3).map((p, i) => shiftEast(p, i % 2 === 0 ? 2 : -2));

    const track = analyze(points);

    expect(track.diagnostics.unsmoothedDistanceM).toBeGreaterThan(900);
    expect(track.distanceM).toBeLessThan(track.diagnostics.unsmoothedDistanceM * 0.7);
    expect(track.distanceM).toBeGreaterThan(600);
  });

  it('counts raw distance and mocked fixes for diagnostics', () => {
    const points = straightLine(10, 3).map((p, i) => ({ ...p, mocked: i < 3 }));

    const track = analyze(points);

    expect(track.diagnostics.mockedCount).toBe(3);
    expect(track.diagnostics.rawDistanceM).toBeCloseTo(30, 6);
    expect(track.diagnostics.longestGapMs).toBe(1000);
    expect(track.diagnostics.averageAccuracyM).toBe(5);
  });

  it('handles a workout with no fixes at all', () => {
    const track = analyzeTrack({
      activity: 'walk',
      startedAt: T0,
      endAt: T0 + 30_000,
      points: [],
      pauses: [],
    });

    expect(track.distanceM).toBe(0);
    expect(track.movingMs).toBe(30_000);
    expect(track.averagePaceSecPerKm).toBeNull();
    expect(track.segments).toEqual([]);
  });
});

describe('auto-pause', () => {
  /** Runs at 3 m/s for 60 s, stands still (with ±1 m GPS wobble), then runs 60 s more. */
  function runWithStop(stopSeconds: number, runAfter = 60): TrackPoint[] {
    const speeds = [
      ...Array.from({ length: 60 }, () => 3),
      ...Array.from({ length: stopSeconds }, () => 0),
      ...Array.from({ length: runAfter }, () => 3),
    ];
    return trackFromSpeeds(speeds).map((point, i) =>
      i > 60 && i <= 60 + stopSeconds ? shiftEast(point, i % 2 === 0 ? 1 : -1) : point,
    );
  }

  it('leaves a 30-second stop out of moving time and distance', () => {
    const points = runWithStop(30);

    const on = analyze(points, { autoPause: true });
    const off = analyze(points);

    // Detection needs a moment at each end of the stop, so allow a couple of seconds.
    expect(on.diagnostics.autoPausedMs).toBeGreaterThanOrEqual(27_000);
    expect(on.diagnostics.autoPausedMs).toBeLessThanOrEqual(30_000);
    expect(on.movingMs).toBe(150_000 - on.diagnostics.autoPausedMs);
    expect(Math.abs(on.distanceM - 360)).toBeLessThan(6);

    // Without auto-pause the wobble while standing adds distance and the clock keeps going.
    expect(off.movingMs).toBe(150_000);
    expect(off.distanceM).toBeGreaterThan(on.distanceM + 10);
  });

  it('ignores a stop shorter than five seconds', () => {
    const track = analyze(runWithStop(3), { autoPause: true });
    expect(track.diagnostics.autoPausedMs).toBe(0);
  });

  it('keeps the clock stopped until the end while still standing', () => {
    const points = runWithStop(20, 0);
    const last = points[points.length - 1];

    const track = analyze(points, { autoPause: true, endAt: last.t + 10_000 });

    expect(track.endsStopped).toBe(true);
    expect(currentPaceSecPerKm(track)).toBeNull();
    // The 20 s stop plus the 10 s since the last fix, less the moment it takes to notice.
    expect(track.diagnostics.autoPausedMs).toBeGreaterThanOrEqual(27_000);
    expect(track.movingMs).toBeLessThanOrEqual(63_000);
  });

  it('uses a lower stop speed for walks than for runs', () => {
    const slowWalk = straightLine(60, 0.8); // a slow stroll

    expect(analyze(slowWalk, { activity: 'walk', autoPause: true }).diagnostics.autoPausedMs).toBe(
      0,
    );
    expect(
      analyze(slowWalk, { activity: 'run', autoPause: true }).diagnostics.autoPausedMs,
    ).toBeGreaterThan(50_000);
  });
});

describe('smooth', () => {
  it('keeps the first and last points where they are', () => {
    const points = straightLine(5, 3).map((p, i) => shiftEast(p, i * i));
    const smoothed = smooth(points, 3);

    expect(smoothed[0]).toEqual(points[0]);
    expect(smoothed[5]).toEqual(points[5]);
    expect(smoothed[2].lng).toBeCloseTo((points[1].lng + points[2].lng + points[3].lng) / 3, 12);
  });

  it('does nothing with a window of 1', () => {
    const points = straightLine(5, 3);
    expect(smooth(points, 1)).toBe(points);
  });
});

describe('currentPaceSecPerKm', () => {
  it('reflects the last 20 seconds, not the whole workout', () => {
    // 60 s at 4 m/s (4:10 /km), then 30 s at 5 m/s (3:20 /km).
    const speeds = [...Array.from({ length: 60 }, () => 4), ...Array.from({ length: 30 }, () => 5)];
    const track = analyze(trackFromSpeeds(speeds));

    expect(currentPaceSecPerKm(track)).toBeCloseTo(200, 6);
    expect(track.averagePaceSecPerKm).toBeGreaterThan(200);
  });

  it('is blank right after a pause, until there is enough new distance', () => {
    const points = straightLine(100, 3);
    const pauses = [{ startedAt: T0 + 50_000, endedAt: T0 + 99_000 }];

    const track = analyze(points, { pauses });

    expect(currentPaceSecPerKm(track)).toBeNull(); // only 1 s (3 m) since resuming
  });
});

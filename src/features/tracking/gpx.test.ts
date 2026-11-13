import { describe, expect, it } from '@jest/globals';

import { readFixture, straightLine, T0 } from './__fixtures__/trackBuilder';
import { buildGpx, parseGpx } from './gpx';
import { analyzeTrack } from './pipeline';
import { computeSplits, splitsForSummary } from './splits';

describe('buildGpx and parseGpx', () => {
  it('round-trips points, pauses and workout details', () => {
    const points = straightLine(5, 3).map((p) => ({ ...p, alt: 35.5 }));
    const xml = buildGpx({
      name: 'Morning run & "hills"',
      activity: 'run',
      startedAt: T0,
      endedAt: T0 + 5000,
      pauses: [{ startedAt: T0 + 2000, endedAt: T0 + 3000 }],
      points,
    });

    const parsed = parseGpx(xml);

    expect(parsed.name).toBe('Morning run & "hills"');
    expect(parsed.activity).toBe('run');
    expect(parsed.startedAt).toBe(T0);
    expect(parsed.endedAt).toBe(T0 + 5000);
    expect(parsed.pauses).toEqual([{ startedAt: T0 + 2000, endedAt: T0 + 3000 }]);
    expect(parsed.points).toHaveLength(points.length);
    parsed.points.forEach((point, i) => {
      expect(point.t).toBe(points[i].t);
      expect(point.lat).toBeCloseTo(points[i].lat, 6);
      expect(point.lng).toBeCloseTo(points[i].lng, 6);
      expect(point.alt).toBe(35.5);
      expect(point.accuracy).toBe(5);
      expect(point.speed).toBe(3);
    });
  });

  it('keeps an open pause open', () => {
    const xml = buildGpx({
      name: 'x',
      activity: 'walk',
      startedAt: T0,
      endedAt: null,
      pauses: [{ startedAt: T0 + 1000, endedAt: null }],
      points: [],
    });

    const parsed = parseGpx(xml);

    expect(parsed.activity).toBe('walk');
    expect(parsed.endedAt).toBeNull();
    expect(parsed.pauses).toEqual([{ startedAt: T0 + 1000, endedAt: null }]);
  });

  it('reads GPX from other apps, which has no accuracy', () => {
    const xml = `<?xml version="1.0"?>
      <gpx version="1.1" creator="Another app"><trk><trkseg>
        <trkpt lat='48.1' lon='2.1'><ele>10</ele><time>2026-01-05T07:00:00Z</time></trkpt>
        <trkpt lon="2.1001" lat="48.1001"><time>2026-01-05T07:00:01Z</time></trkpt>
        <trkpt lat="48.2" lon="2.2"/>
      </trkseg></trk></gpx>`;

    const withDefault = parseGpx(xml, { defaultAccuracyM: 5 });
    const withoutDefault = parseGpx(xml);

    expect(withDefault.points).toHaveLength(2); // the point without a time is skipped
    expect(withDefault.points[0]).toMatchObject({ lat: 48.1, lng: 2.1, alt: 10, accuracy: 5 });
    expect(withDefault.points[1]).toMatchObject({ lng: 2.1001, alt: null, accuracy: 5 });
    expect(withDefault.activity).toBeNull();
    expect(withDefault.pauses).toEqual([]);
    expect(withoutDefault.points[0].accuracy).toBeNull();
  });
});

describe('replaying a recorded GPX file', () => {
  // Two laps of a 1 km loop at 5:00 /km with realistic GPS noise, three
  // inaccurate fixes, one 150 m jump and one repeated timestamp planted in it.
  const run = parseGpx(readFixture('loop-2km-run.gpx'));
  const replay = (pauses = run.pauses) =>
    analyzeTrack({
      activity: run.activity ?? 'run',
      startedAt: run.startedAt ?? T0,
      endAt: run.endedAt ?? T0,
      points: run.points,
      pauses,
    });

  it('measures the 2 km loop within ±3 %', () => {
    const track = replay();
    expect(Math.abs(track.distanceM - 2000) / 2000).toBeLessThan(0.03);
    expect(track.movingMs).toBe(600_000);
  });

  it('drops exactly the planted bad fixes', () => {
    expect(replay().diagnostics.dropped).toEqual({
      outsideWorkout: 0,
      paused: 0,
      inaccurate: 3,
      outOfOrder: 1,
      tooFast: 1,
    });
  });

  it('measures less than the raw track, which includes the noise and bad fixes', () => {
    const track = replay();
    expect(track.distanceM).toBeLessThan(track.diagnostics.rawDistanceM);
  });

  it('gives kilometre splits of about 5:00', () => {
    // Smoothing cuts the loop's eight corners slightly (about 1989 m measured),
    // so this is one full kilometre plus a 0.99 km leftover.
    const splits = splitsForSummary(computeSplits(replay(), 1000));

    expect(splits).toHaveLength(2);
    splits.forEach((split) => {
      expect(Math.abs((split.paceSecPerKm ?? 0) - 300) / 300).toBeLessThan(0.03);
    });
  });

  it('leaves a one-minute pause out of time and distance', () => {
    const start = run.startedAt ?? T0;
    const track = replay([{ startedAt: start + 120_000, endedAt: start + 180_000 }]);

    expect(track.movingMs).toBe(540_000);
    expect(track.segments).toHaveLength(2);
    expect(Math.abs(track.distanceM - 1800) / 1800).toBeLessThan(0.03);
  });
});

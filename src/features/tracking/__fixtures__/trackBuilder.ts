// Test-only file, run by Jest in Node (never bundled into the app), so it can read files.
/// <reference types="node" />
import { readFileSync } from 'fs';
import path from 'path';

import type { TrackPoint } from '../types';

// Helpers for building GPS tracks in tests. Moving due north keeps the maths
// exact: along a meridian, haversine distance is just radius × angle.

const M_PER_DEG_LAT = (Math.PI * 6_371_000) / 180;
const START = { lat: 48.85, lng: 2.35 };

/** 5 January 2026, 07:00 UTC. Every built track starts here. */
export const T0 = Date.UTC(2026, 0, 5, 7, 0, 0);

function makePoint(second: number, lat: number, speed: number): TrackPoint {
  return {
    t: T0 + second * 1000,
    lat,
    lng: START.lng,
    alt: null,
    accuracy: 5,
    speed,
    mocked: false,
  };
}

/**
 * One fix per second, heading north. `speedsMps[i]` is the speed during
 * second i, so n speeds give n + 1 points.
 */
export function trackFromSpeeds(speedsMps: number[]): TrackPoint[] {
  let lat = START.lat;
  const points = [makePoint(0, lat, speedsMps[0] ?? 0)];
  speedsMps.forEach((speed, i) => {
    lat += speed / M_PER_DEG_LAT;
    points.push(makePoint(i + 1, lat, speed));
  });
  return points;
}

/** A clean straight line at a steady speed. */
export function straightLine(seconds: number, speedMps: number): TrackPoint[] {
  return trackFromSpeeds(Array.from({ length: seconds }, () => speedMps));
}

/** Moves a point sideways (east, or west for negative metres). */
export function shiftEast(point: TrackPoint, metres: number): TrackPoint {
  const metresPerDegLng = M_PER_DEG_LAT * Math.cos((point.lat * Math.PI) / 180);
  return { ...point, lng: point.lng + metres / metresPerDegLng };
}

export function readFixture(fileName: string): string {
  return readFileSync(path.join(__dirname, fileName), 'utf8');
}

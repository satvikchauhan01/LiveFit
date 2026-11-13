import { type ActivityType, isActivityType } from '@/db/schema';

import type { PauseInterval, TrackPoint } from './types';

// GPX 1.1 is the standard GPS exchange format that Strava, Garmin and most map
// tools understand. Raw points are exported (not the filtered route), plus a few
// LiveFit extras — accuracy, speed, pauses — so a file can be replayed through
// the pipeline in tests and give the same distance as on the phone.

const LIVEFIT_NS = 'urn:livefit:gpx:1';

export type GpxWorkout = {
  name: string;
  activity: ActivityType | null;
  startedAt: number | null;
  endedAt: number | null;
  pauses: PauseInterval[];
  points: TrackPoint[];
};

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function unescapeXml(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

const iso = (ms: number) => new Date(ms).toISOString();

export function buildGpx(workout: GpxWorkout): string {
  const { name, activity, startedAt, endedAt, pauses, points } = workout;

  const metadataExtensions = [
    activity && startedAt !== null
      ? `      <livefit:workout type="${activity}" start="${iso(startedAt)}"${
          endedAt !== null ? ` end="${iso(endedAt)}"` : ''
        }/>`
      : null,
    ...pauses.map(
      (pause) =>
        `      <livefit:pause start="${iso(pause.startedAt)}"${
          pause.endedAt !== null ? ` end="${iso(pause.endedAt)}"` : ''
        }/>`,
    ),
  ].filter((line): line is string => line !== null);

  const trackPoints = points.map((p) => {
    const extras = [
      p.accuracy !== null ? `<livefit:accuracy>${p.accuracy.toFixed(1)}</livefit:accuracy>` : '',
      p.speed !== null ? `<livefit:speed>${p.speed.toFixed(2)}</livefit:speed>` : '',
    ].join('');
    return [
      `      <trkpt lat="${p.lat.toFixed(7)}" lon="${p.lng.toFixed(7)}">`,
      p.alt !== null ? `<ele>${p.alt.toFixed(1)}</ele>` : '',
      `<time>${iso(p.t)}</time>`,
      extras ? `<extensions>${extras}</extensions>` : '',
      '</trkpt>',
    ].join('');
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<gpx version="1.1" creator="LiveFit" xmlns="http://www.topografix.com/GPX/1/1" xmlns:livefit="${LIVEFIT_NS}">`,
    '  <metadata>',
    `    <name>${escapeXml(name)}</name>`,
    startedAt !== null ? `    <time>${iso(startedAt)}</time>` : null,
    metadataExtensions.length > 0
      ? ['    <extensions>', ...metadataExtensions, '    </extensions>'].join('\n')
      : null,
    '  </metadata>',
    '  <trk>',
    `    <name>${escapeXml(name)}</name>`,
    activity ? `    <type>${activity}</type>` : null,
    '    <trkseg>',
    ...trackPoints,
    '    </trkseg>',
    '  </trk>',
    '</gpx>',
    '',
  ]
    .filter((line): line is string => line !== null)
    .join('\n');
}

function attribute(attributes: string, name: string): string | null {
  const match = new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`).exec(attributes);
  return match ? unescapeXml(match[1]) : null;
}

function tagText(xml: string, tag: string): string | null {
  const match = new RegExp(`<${tag}>([^<]*)</${tag}>`).exec(xml);
  return match ? unescapeXml(match[1].trim()) : null;
}

function toNumber(text: string | null): number | null {
  if (text === null || text === '') return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

function toTime(text: string | null): number | null {
  if (text === null) return null;
  const value = Date.parse(text);
  return Number.isNaN(value) ? null : value;
}

export type ParseGpxOptions = {
  /**
   * Accuracy to assume when a point has none (files from other apps don't
   * include it). Without it those points would all be dropped as inaccurate.
   */
  defaultAccuracyM?: number;
};

/** Reads a GPX file (from LiveFit or another app) back into track points. */
export function parseGpx(xml: string, options: ParseGpxOptions = {}): GpxWorkout {
  const points: TrackPoint[] = [];
  for (const match of xml.matchAll(/<trkpt\b([^>]*?)(?:\/>|>([\s\S]*?)<\/trkpt>)/g)) {
    const attributes = match[1];
    const body = match[2] ?? '';
    const lat = toNumber(attribute(attributes, 'lat'));
    const lng = toNumber(attribute(attributes, 'lon'));
    const t = toTime(tagText(body, 'time'));
    if (lat === null || lng === null || t === null) {
      continue; // a point without a time can't be replayed
    }
    points.push({
      t,
      lat,
      lng,
      alt: toNumber(tagText(body, 'ele')),
      accuracy: toNumber(tagText(body, 'livefit:accuracy')) ?? options.defaultAccuracyM ?? null,
      speed: toNumber(tagText(body, 'livefit:speed')),
      mocked: false,
    });
  }

  const workoutAttributes = /<livefit:workout\b([^>]*?)\/?>/.exec(xml)?.[1] ?? '';
  const type = attribute(workoutAttributes, 'type');

  const pauses: PauseInterval[] = [];
  for (const match of xml.matchAll(/<livefit:pause\b([^>]*?)\/?>/g)) {
    const startedAt = toTime(attribute(match[1], 'start'));
    if (startedAt !== null) {
      pauses.push({ startedAt, endedAt: toTime(attribute(match[1], 'end')) });
    }
  }

  return {
    name: tagText(xml, 'name') ?? '',
    activity: isActivityType(type) ? type : null,
    startedAt: toTime(attribute(workoutAttributes, 'start')),
    endedAt: toTime(attribute(workoutAttributes, 'end')),
    pauses,
    points,
  };
}

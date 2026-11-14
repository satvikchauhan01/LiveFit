import type { Split } from '@/features/tracking/splits';
import { type DistanceUnit, METERS_PER_KM, METERS_PER_MILE } from '@/lib/units';

// What the voice says. Written for the ear: "5 minutes 12 seconds", not "5:12".

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

/** 312_000 → "5 minutes 12 seconds", 3_725_000 → "1 hour 2 minutes 5 seconds". */
export function spokenDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const parts: string[] = [];
  if (hours > 0) parts.push(plural(hours, 'hour'));
  if (minutes > 0) parts.push(plural(minutes, 'minute'));
  if (seconds > 0 || parts.length === 0) parts.push(plural(seconds, 'second'));
  return parts.join(' ');
}

const UNIT_WORD: Record<DistanceUnit, string> = { km: 'kilometre', mi: 'mile' };

/** 400 → "400 metres", 2500 → "2.5 kilometres", or in miles. */
export function spokenDistance(meters: number, unit: DistanceUnit): string {
  if (unit === 'km' && meters < METERS_PER_KM) {
    return plural(Math.round(meters), 'metre');
  }
  const value = meters / (unit === 'km' ? METERS_PER_KM : METERS_PER_MILE);
  const rounded = Math.round(value * 100) / 100;
  return `${rounded} ${UNIT_WORD[unit]}${rounded === 1 ? '' : 's'}`;
}

/** At each km/mile: "2 kilometres. Time 10 minutes 24 seconds. Last kilometre 5 minutes 10 seconds." */
export function splitAnnouncement(split: Split, unit: DistanceUnit, totalMovingMs: number): string {
  return [
    `${plural(split.index, UNIT_WORD[unit])}.`,
    `Time ${spokenDuration(totalMovingMs)}.`,
    `Last ${UNIT_WORD[unit]} ${spokenDuration(split.durationMs)}.`,
  ].join(' ');
}

/** After pressing Lap: "Lap 2. 400 metres in 1 minute 32 seconds." */
export function lapAnnouncement(lap: Split, unit: DistanceUnit): string {
  return `Lap ${lap.index}. ${spokenDistance(lap.distanceM, unit)} in ${spokenDuration(lap.durationMs)}.`;
}

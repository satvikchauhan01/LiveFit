import { formatPaceValue } from '@/lib/format';
import { type DistanceUnit, METERS_PER_MILE } from '@/lib/units';

import type { Measure } from './activities';

// Pace (time per distance) for runners, speed (distance per hour) for cyclists:
// the same number, shown the way each sport thinks about it.

const SPEED_UNIT: Record<DistanceUnit, string> = { km: 'km/h', mi: 'mph' };

/** 300 s/km → "5:00" as pace, or "12.0" as speed. */
export function rateValue(
  secondsPerKm: number | null,
  unit: DistanceUnit,
  measure: Measure,
): string {
  if (measure === 'pace') return formatPaceValue(secondsPerKm, unit);
  if (secondsPerKm === null || !Number.isFinite(secondsPerKm) || secondsPerKm <= 0) return '–';
  const perHour = 3600 / secondsPerKm; // km/h
  return (unit === 'km' ? perHour : perHour / (METERS_PER_MILE / 1000)).toFixed(1);
}

/** "/km" for pace, "km/h" (or "mph") for speed. */
export function rateUnit(unit: DistanceUnit, measure: Measure): string {
  return measure === 'pace' ? `/${unit}` : SPEED_UNIT[unit];
}

/** "Pace /km", "Avg speed km/h". */
export function rateLabel(unit: DistanceUnit, measure: Measure, average = false): string {
  const name = measure === 'pace' ? 'pace' : 'speed';
  const label = average ? `Avg ${name}` : name.charAt(0).toUpperCase() + name.slice(1);
  return `${label} ${rateUnit(unit, measure)}`;
}

/** "5:00 /km" or "12.0 km/h". */
export function formatRate(
  secondsPerKm: number | null,
  unit: DistanceUnit,
  measure: Measure,
): string {
  const value = rateValue(secondsPerKm, unit, measure);
  return value === '–' ? value : `${value} ${rateUnit(unit, measure)}`;
}

import {
  type DistanceUnit,
  fromKg,
  metersPerUnit,
  METERS_PER_MILE,
  type WeightUnit,
} from './units';

function pad2(value: number): string {
  return value.toString().padStart(2, '0');
}

/** 75_000 → "1:15", 3_725_000 → "1:02:05" */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0 ? `${hours}:${pad2(minutes)}:${pad2(seconds)}` : `${minutes}:${pad2(seconds)}`;
}

export const DISTANCE_UNIT_NAME: Record<DistanceUnit, { singular: string; plural: string }> = {
  km: { singular: 'Km', plural: 'Kilometres' },
  mi: { singular: 'Mile', plural: 'Miles' },
};

/** 1234 → "1.23" (in km) or "0.77" (in mi), without the unit. */
export function formatDistanceValue(meters: number, unit: DistanceUnit = 'km'): string {
  return (meters / metersPerUnit(unit)).toFixed(2);
}

/** 1234 → "1.23 km" (or "0.77 mi") */
export function formatDistance(meters: number, unit: DistanceUnit = 'km'): string {
  return `${formatDistanceValue(meters, unit)} ${unit}`;
}

/** Pace is stored as seconds per km. 342 → "5:42" per km (or "9:10" per mile). */
export function formatPaceValue(secondsPerKm: number | null, unit: DistanceUnit = 'km'): string {
  if (secondsPerKm === null || !Number.isFinite(secondsPerKm)) {
    return '–';
  }
  const secondsPerUnit = unit === 'km' ? secondsPerKm : secondsPerKm * (METERS_PER_MILE / 1000);
  const rounded = Math.round(secondsPerUnit);
  return `${Math.floor(rounded / 60)}:${pad2(rounded % 60)}`;
}

/** 342 → "5:42 /km" (or "9:10 /mi") */
export function formatPace(secondsPerKm: number | null, unit: DistanceUnit = 'km'): string {
  const value = formatPaceValue(secondsPerKm, unit);
  return value === '–' ? value : `${value} /${unit}`;
}

/** 72.5 kg → "72.5 kg" or "159.8 lb" */
export function formatWeight(kg: number | null, unit: WeightUnit): string {
  if (kg === null) {
    return '–';
  }
  return `${fromKg(kg, unit).toFixed(1)} ${unit}`;
}

export function formatMeters(meters: number | null): string {
  return meters === null ? '–' : `${Math.round(meters)} m`;
}

export function formatDateTime(ms: number): string {
  const date = new Date(ms);
  return `${date.toLocaleDateString()} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/** "14:05" in local time. */
export function formatClockTime(ms: number): string {
  const date = new Date(ms);
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/** Battery used per hour, e.g. "6.5 %/h". Needs both readings and at least a few minutes of data. */
export function formatBatteryDrain(
  batteryStart: number | null,
  batteryEnd: number | null,
  durationMs: number,
): string {
  if (batteryStart === null || batteryEnd === null || durationMs < 5 * 60 * 1000) {
    return '–';
  }
  const usedPercent = (batteryStart - batteryEnd) * 100;
  const hours = durationMs / 3_600_000;
  return `${(usedPercent / hours).toFixed(1)} %/h`;
}

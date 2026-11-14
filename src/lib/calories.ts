import type { ActivityType } from '@/db/schema';

/** Used when the user hasn't entered a weight; the estimate says so. */
export const DEFAULT_WEIGHT_KG = 70;

/**
 * MET ("metabolic equivalent"): how many times more energy an activity uses
 * than sitting still. Values follow the Compendium of Physical Activities,
 * picked by activity and average speed.
 */
export function metFor(activity: ActivityType, speedKmh: number | null): number {
  const speed = speedKmh ?? 0;
  switch (activity) {
    case 'run':
      if (speed < 8) return 7;
      if (speed < 9.7) return 8.3;
      if (speed < 11.3) return 9.8;
      if (speed < 12.9) return 11;
      if (speed < 14.5) return 11.8;
      return 12.8;
    case 'walk':
      if (speed < 3.2) return 2;
      if (speed < 4.8) return 3;
      if (speed < 5.6) return 3.5;
      if (speed < 6.4) return 4.3;
      return 5;
    case 'cycle':
      if (speed < 16) return 4;
      if (speed < 19) return 6.8;
      if (speed < 22.5) return 8;
      if (speed < 25.7) return 10;
      return 12;
    case 'hike':
      return 6;
    case 'wheelchair':
      return speed < 5 ? 3.8 : 5.5;
    case 'strength':
      return 5;
  }
}

/**
 * Estimated calories: MET × body weight (kg) × hours. An estimate only (it
 * ignores fitness, terrain and heart rate), and always shown as one.
 */
export function estimateCalories(input: {
  activity: ActivityType;
  movingS: number;
  distanceM: number | null;
  weightKg: number | null;
}): number {
  const hours = input.movingS / 3600;
  if (hours <= 0) return 0;
  const speedKmh = input.distanceM !== null ? input.distanceM / 1000 / hours : null;
  const weight = input.weightKg ?? DEFAULT_WEIGHT_KG;
  return Math.round(metFor(input.activity, speedKmh) * weight * hours);
}

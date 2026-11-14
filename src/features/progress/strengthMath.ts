import type { WeightUnit } from '@/lib/units';

/**
 * Estimated one-rep max (the most you could lift once), Epley formula:
 * weight × (1 + reps / 30). Only trusted for sets of 10 reps or fewer.
 */
export function estimatedOneRepMax(weightKg: number, reps: number): number | null {
  if (reps < 1 || reps > 10 || weightKg <= 0) return null;
  return reps === 1 ? weightKg : weightKg * (1 + reps / 30);
}

/** Standard plate sizes, heaviest first, per unit. */
export const PLATES: Record<WeightUnit, number[]> = {
  kg: [25, 20, 15, 10, 5, 2.5, 1.25],
  lb: [45, 35, 25, 10, 5, 2.5],
};

export const BARS: Record<WeightUnit, number[]> = {
  kg: [20, 15, 10],
  lb: [45, 35, 25],
};

export type PlateLoad = {
  /** Plates for ONE side of the bar, heaviest first. */
  perSide: number[];
  /** What the bar actually weighs with those plates (may be below the target). */
  total: number;
};

/**
 * Which plates to put on each side to reach `target` (all in the same unit).
 * Greedy, heaviest first, which is how people load a bar and gives the fewest plates.
 */
export function platesFor(target: number, bar: number, plates: number[]): PlateLoad {
  let remaining = (target - bar) / 2;
  const perSide: number[] = [];
  for (const plate of plates) {
    while (remaining >= plate - 1e-9) {
      perSide.push(plate);
      remaining -= plate;
    }
  }
  const sideTotal = perSide.reduce((sum, plate) => sum + plate, 0);
  return { perSide, total: bar + sideTotal * 2 };
}

/**
 * Progressive overload: if every set last time was the same weight and reps,
 * suggest a small step up, either a little more weight or one more rep.
 */
export function overloadHint(
  lastSets: { weightKg: number | null; reps: number | null }[],
  unit: WeightUnit,
): { weightKg: number; reps: number; moreReps: number } | null {
  if (lastSets.length === 0) return null;
  const [first] = lastSets;
  if (first.weightKg === null || first.reps === null || first.weightKg <= 0) return null;
  const consistent = lastSets.every(
    (set) => set.weightKg === first.weightKg && set.reps === first.reps,
  );
  if (!consistent) return null;
  // The smallest common step: 2.5 kg (two 1.25 kg plates) or 5 lb (two 2.5 lb plates).
  const stepKg = unit === 'kg' ? 2.5 : 5 / 2.2046226218;
  return { weightKg: first.weightKg + stepKg, reps: first.reps, moreReps: first.reps + 1 };
}

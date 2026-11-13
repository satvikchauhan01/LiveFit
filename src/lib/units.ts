export type DistanceUnit = 'km' | 'mi';
export type WeightUnit = 'kg' | 'lb';

// Everything is stored in metric (metres, kilograms, seconds per km)
// and only converted when shown to the user.
export const METERS_PER_KM = 1000;
export const METERS_PER_MILE = 1609.344;
export const LB_PER_KG = 2.2046226218;

export function kgToLb(kg: number): number {
  return kg * LB_PER_KG;
}

export function lbToKg(lb: number): number {
  return lb / LB_PER_KG;
}

/** Converts a weight typed in the user's unit to kilograms. */
export function toKg(value: number, unit: WeightUnit): number {
  return unit === 'kg' ? value : lbToKg(value);
}

/** Converts kilograms to the user's unit. */
export function fromKg(kg: number, unit: WeightUnit): number {
  return unit === 'kg' ? kg : kgToLb(kg);
}

export function metersPerUnit(unit: DistanceUnit): number {
  return unit === 'km' ? METERS_PER_KM : METERS_PER_MILE;
}

import { toKg, type WeightUnit } from '@/lib/units';

const MIN_KG = 20;
const MAX_KG = 400;

export type WeightParseResult = { ok: true; kg: number | null } | { ok: false; message: string };

/**
 * Turns what the user typed into kilograms.
 * Empty input is allowed and means "not provided".
 */
export function parseWeightInput(text: string, unit: WeightUnit): WeightParseResult {
  const trimmed = text.trim().replace(',', '.');
  if (trimmed === '') {
    return { ok: true, kg: null };
  }

  const value = Number(trimmed);
  if (!Number.isFinite(value)) {
    return { ok: false, message: 'Enter a number, like 70 or 70.5.' };
  }

  const kg = toKg(value, unit);
  if (kg < MIN_KG || kg > MAX_KG) {
    return { ok: false, message: 'That weight looks off. Check the number and the unit.' };
  }
  // Two decimals keeps "160 lb" showing as 160.0 lb after the round trip through kg.
  return { ok: true, kg: Math.round(kg * 100) / 100 };
}

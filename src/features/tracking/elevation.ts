import { GPS_SETTINGS } from './config';

export type ElevationChange = { gainM: number; lossM: number };

/**
 * Total climbing and descending. GPS altitude is noisy (it can jump several
 * metres while you stand still), so it's smoothed first, and only changes of at
 * least `thresholdM` from the last counted level count. Small wobbles never add up.
 */
export function elevationChange(
  altitudes: (number | null)[],
  thresholdM: number = GPS_SETTINGS.elevationThresholdM,
  window: number = GPS_SETTINGS.elevationSmoothingWindow,
): ElevationChange {
  const values = altitudes.filter((alt): alt is number => alt !== null && Number.isFinite(alt));
  if (values.length < 2) {
    return { gainM: 0, lossM: 0 };
  }

  const half = Math.floor(window / 2);
  const smoothed = values.map((_, i) => {
    const from = Math.max(0, i - half);
    const to = Math.min(values.length - 1, i + half);
    let sum = 0;
    for (let j = from; j <= to; j += 1) sum += values[j];
    return sum / (to - from + 1);
  });

  let level = smoothed[0];
  let gainM = 0;
  let lossM = 0;
  for (const altitude of smoothed) {
    const change = altitude - level;
    if (change >= thresholdM) {
      gainM += change;
      level = altitude;
    } else if (change <= -thresholdM) {
      lossM -= change;
      level = altitude;
    }
  }
  return { gainM, lossM };
}

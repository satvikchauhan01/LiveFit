import { GPS_SETTINGS } from './config';
import type { TrackPoint } from './types';

export type GpsSignal = 'none' | 'weak' | 'good' | 'strong';

export function gpsSignalFor(accuracyM: number | null | undefined): GpsSignal {
  if (accuracyM === null || accuracyM === undefined) return 'none';
  if (accuracyM <= GPS_SETTINGS.strongFixAccuracyM) return 'strong';
  if (accuracyM <= GPS_SETTINGS.goodFixAccuracyM) return 'good';
  return 'weak';
}

/** Signal from the latest recorded fix; a fix that's too old means the signal was lost. */
export function gpsSignalForLastFix(point: TrackPoint | undefined, now: number): GpsSignal {
  if (!point || now - point.t > GPS_SETTINGS.signalLostAfterMs) {
    return 'none';
  }
  return gpsSignalFor(point.accuracy);
}

export function isGoodEnoughToStart(signal: GpsSignal): boolean {
  return signal === 'good' || signal === 'strong';
}

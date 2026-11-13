import * as Battery from 'expo-battery';
import * as Location from 'expo-location';

import type { ActivityType } from '@/db/schema';
import { LOCATION_TASK } from '@/features/tracking/locationTask';
import { colors } from '@/theme/tokens';

export type ActionResult = { ok: true } | { ok: false; reason: string };

/** Checks that location is switched on and allowed, asking for permission if needed. */
export async function ensureLocationReady(): Promise<ActionResult> {
  if (!(await Location.hasServicesEnabledAsync())) {
    return { ok: false, reason: 'Location is turned off. Turn it on in your phone settings.' };
  }
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) {
    return { ok: false, reason: 'LiveFit needs location permission to record a route.' };
  }
  return { ok: true };
}

export function isLocationTaskRunning(): Promise<boolean> {
  return Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
}

const ACTIVITY_NAMES: Record<ActivityType, string> = { run: 'run', walk: 'walk' };

/**
 * Starts GPS recording as an Android foreground service. Must be called while
 * the app is on screen: Android doesn't let apps start one from the background.
 */
export async function startLocationUpdates(activity: ActivityType): Promise<void> {
  if (await isLocationTaskRunning()) {
    return;
  }
  await Location.startLocationUpdatesAsync(LOCATION_TASK, {
    accuracy: Location.Accuracy.BestForNavigation,
    timeInterval: 1000,
    distanceInterval: 0,
    // iOS: tell the system this is a workout, and keep the blue location pill visible.
    activityType: Location.ActivityType.Fitness,
    showsBackgroundLocationIndicator: true,
    pausesUpdatesAutomatically: false,
    // Android: the persistent notification is what keeps GPS alive with the
    // screen off, using only "While using the app" permission.
    foregroundService: {
      notificationTitle: `LiveFit is recording your ${ACTIVITY_NAMES[activity]}`,
      notificationBody: 'Open LiveFit to pause or finish.',
      notificationColor: colors.accent,
      // Keep recording if the app is swiped away from recent apps.
      killServiceOnDestroy: false,
    },
  });
}

export async function stopLocationUpdates(): Promise<void> {
  if (await isLocationTaskRunning()) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  }
}

/** Battery level between 0 and 1, or null when unknown (e.g. on an emulator). */
export async function readBatteryLevel(): Promise<number | null> {
  try {
    const level = await Battery.getBatteryLevelAsync();
    return level >= 0 ? level : null;
  } catch {
    return null;
  }
}

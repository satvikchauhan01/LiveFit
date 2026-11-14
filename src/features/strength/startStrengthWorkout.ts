import { Alert } from 'react-native';

import { primeRestAlerts } from './primeRestAlerts';
import { useStrengthStore } from './strengthStore';

/**
 * Asks about rest alerts the first time, then opens a strength workout.
 * Returns false (after telling the user why) if it couldn't start.
 * The caller decides how to show the workout screen.
 */
export async function startStrengthWorkout(): Promise<boolean> {
  await primeRestAlerts();
  const result = await useStrengthStore.getState().start();
  if (!result.ok) {
    Alert.alert('Couldn’t start', result.reason);
    return false;
  }
  return true;
}

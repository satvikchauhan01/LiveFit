import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

// Local notifications for the rest timer. They're scheduled with the system,
// so the alert arrives even if the screen is off or LiveFit was swiped away.

const CHANNEL_ID = 'rest-timer';

// Show the alert even while LiveFit is open (by default it's only shown in the background).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Android groups notifications into channels the user can tune in system settings. */
export async function setUpRestAlertChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Rest timer',
    description: 'Tells you when your rest between sets is over.',
    importance: AndroidImportance.HIGH,
    vibrationPattern: [0, 400, 200, 400],
  });
}

export type AlertPermission = 'granted' | 'undetermined' | 'denied' | 'blocked';

export async function getAlertPermission(): Promise<AlertPermission> {
  const permission = await Notifications.getPermissionsAsync();
  if (permission.granted) return 'granted';
  if (permission.status === 'undetermined') return 'undetermined';
  return permission.canAskAgain ? 'denied' : 'blocked';
}

export async function requestAlertPermission(): Promise<AlertPermission> {
  await Notifications.requestPermissionsAsync();
  return getAlertPermission();
}

/**
 * Android 12+ only promises exact timing if the user allows "Alarms & reminders"
 * for the app. Without it the alert may come a little late (the on-screen timer is always exact).
 */
export async function hasExactTiming(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  return (await Notifications.getExactAlarmPermissionsAsync()).granted;
}

export async function requestExactTiming(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  return (await Notifications.requestExactAlarmPermissionsAsync()).granted;
}

/** Schedules "Rest over" for `endsAt`. Returns the id needed to cancel it, or null if alerts are off. */
export async function scheduleRestAlert(endsAt: number): Promise<string | null> {
  if ((await getAlertPermission()) !== 'granted') {
    return null;
  }
  return Notifications.scheduleNotificationAsync({
    content: {
      title: 'Rest over',
      body: 'Time for your next set.',
      sound: 'default',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: endsAt,
      channelId: CHANNEL_ID,
    },
  });
}

export async function cancelRestAlert(id: string | null | undefined): Promise<void> {
  if (!id) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // Already delivered or gone: nothing to cancel.
  }
}

import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

import { getAlertPermission } from '@/features/strength/restAlerts';

import { toNotificationWeekday } from './reminderSchedule';

const CHANNEL_ID = 'reminders';
/** Our reminders' ids start with this, so they can be found and replaced. */
const ID_PREFIX = 'workout-reminder-';

export async function setUpReminderChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Workout reminders',
    description: 'Reminders on the days you choose in Profile.',
    importance: AndroidImportance.DEFAULT,
  });
}

/**
 * Makes the scheduled reminders match the chosen days and time: removes the old
 * ones, then schedules one repeating weekly notification per day. The system
 * keeps them across restarts, so this only needs to run when the settings change.
 */
export async function syncReminders(days: number[], minutesAfterMidnight: number): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((request) => request.identifier.startsWith(ID_PREFIX))
      .map((request) => Notifications.cancelScheduledNotificationAsync(request.identifier)),
  );

  if (days.length === 0 || (await getAlertPermission()) !== 'granted') {
    return;
  }
  for (const day of days) {
    await Notifications.scheduleNotificationAsync({
      identifier: `${ID_PREFIX}${day}`,
      content: {
        title: 'Time to move',
        body: 'A run, a walk or a lift: even a short workout keeps your week on track.',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: toNotificationWeekday(day),
        hour: Math.floor(minutesAfterMidnight / 60),
        minute: minutesAfterMidnight % 60,
        channelId: CHANNEL_ID,
      },
    });
  }
}

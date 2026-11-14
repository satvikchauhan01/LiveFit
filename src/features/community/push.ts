import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';

import { getAlertPermission } from '@/features/strength/restAlerts';

import { communityApi } from './communityApi';

let registeredToken: string | null = null;

/**
 * Push notifications (kudos, comments, follows…) come through Expo's push
 * service. That needs the EAS project id (added by `eas init`) to get a token
 * for this phone, which is then sent to the LiveFit server.
 */
export async function registerForPush(): Promise<void> {
  const projectId = (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)
    ?.projectId;
  if (!projectId) {
    console.info('[push] no EAS project id yet; push notifications are off');
    return;
  }
  if ((await getAlertPermission()) !== 'granted') return;
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  await communityApi.registerPushToken(token);
  registeredToken = token;
}

/** On sign-out: this phone shouldn't get that account's notifications any more. */
export async function unregisterPush(): Promise<void> {
  if (!registeredToken) return;
  await communityApi.unregisterPushToken(registeredToken);
  registeredToken = null;
}

function openFromPush(response: Notifications.NotificationResponse): void {
  const data = response.notification.request.content.data as {
    type?: string;
    workoutId?: string | null;
    clubId?: string | null;
    challengeId?: string | null;
  };
  if (data.workoutId) {
    router.push({ pathname: '/community/workout/[id]', params: { id: data.workoutId } });
  } else if (data.challengeId) {
    router.push({ pathname: '/community/challenge/[id]', params: { id: data.challengeId } });
  } else if (data.clubId) {
    router.push({ pathname: '/community/club/[id]', params: { id: data.clubId } });
  } else if (data.type) {
    router.push('/community/inbox');
  }
}

/** Tapping a push opens the right screen, including one that launched the app. */
export function handlePushTaps(): void {
  Notifications.getLastNotificationResponseAsync()
    .then((response) => {
      if (response) {
        openFromPush(response);
        Notifications.clearLastNotificationResponseAsync().catch(() => {});
      }
    })
    .catch(() => {});
  Notifications.addNotificationResponseReceivedListener(openFromPush);
}

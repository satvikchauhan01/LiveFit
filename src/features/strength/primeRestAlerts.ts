import { Alert } from 'react-native';

import { getAlertPermission, requestAlertPermission } from './restAlerts';

/**
 * A permission primer: explain why before the system dialog appears. It only
 * shows while the answer is still "undetermined"; after that Android remembers.
 */
export async function primeRestAlerts(): Promise<void> {
  if ((await getAlertPermission()) !== 'undetermined') {
    return;
  }
  const allow = await new Promise<boolean>((resolve) =>
    Alert.alert(
      'Rest timer alerts',
      'LiveFit can tell you when your rest between sets is over, even with your phone locked.',
      [
        { text: 'Not now', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Allow', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    ),
  );
  if (allow) {
    await requestAlertPermission();
  }
}

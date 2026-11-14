import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';

import { useAccountStore } from '@/features/account/accountStore';

import { runSync } from './syncEngine';

// Android runs this every so often (at least 15 minutes apart, when the phone
// thinks it's a good moment), so workouts reach the server even if the app
// isn't opened. Like the GPS task, it's defined when the JS bundle loads.

const SYNC_TASK = 'livefit-background-sync';

TaskManager.defineTask(SYNC_TASK, async () => {
  try {
    if (useAccountStore.getState().status === 'loading') {
      await useAccountStore.getState().restore();
    }
    if (useAccountStore.getState().status !== 'signedIn') {
      return BackgroundTask.BackgroundTaskResult.Success;
    }
    await runSync();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function registerBackgroundSync(): Promise<void> {
  const status = await BackgroundTask.getStatusAsync();
  if (status !== BackgroundTask.BackgroundTaskStatus.Available) return;
  if (await TaskManager.isTaskRegisteredAsync(SYNC_TASK)) return;
  await BackgroundTask.registerTaskAsync(SYNC_TASK, { minimumInterval: 30 });
}

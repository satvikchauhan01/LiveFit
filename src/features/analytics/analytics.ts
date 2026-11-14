import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import { AppState } from 'react-native';

import { api, serverConfigured } from '@/features/account/apiClient';
import { useProfileStore } from '@/features/profile/profileStore';
import { readState, writeState } from '@/features/sync/syncRepository';

// Anonymous usage events, sent to your own server (never a third party):
// a feature name and a couple of plain values, tagged with a random id for this
// install, never the account, location or workout details. Off in development
// builds, and the user can switch it off in Profile.

type EventProps = Record<string, string | number | boolean>;
type QueuedEvent = { name: string; props: EventProps };

const MAX_QUEUE = 200;
const FLUSH_DELAY_MS = 30_000;

const queue: QueuedEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let installId: string | null = null;

function enabled(): boolean {
  return (
    !__DEV__ && serverConfigured && useProfileStore.getState().profile?.analyticsEnabled !== false
  );
}

async function getInstallId(): Promise<string> {
  installId ??= await readState('installId');
  if (!installId) {
    installId = Crypto.randomUUID();
    await writeState('installId', installId);
  }
  return installId;
}

async function flush(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (!enabled() || queue.length === 0) {
    queue.length = 0;
    return;
  }
  const events = queue.splice(0, 50);
  try {
    await api('/v1/analytics/events', {
      method: 'POST',
      auth: false,
      body: {
        installId: await getInstallId(),
        appVersion: Constants.expoConfig?.version ?? '',
        events,
      },
    });
  } catch {
    // Offline: keep them for next time (bounded, so it never grows forever).
    queue.unshift(...events.slice(0, MAX_QUEUE - queue.length));
  }
}

/** Records that something happened, e.g. track('workout_finished', { type: 'run' }). */
export function track(name: string, props: EventProps = {}): void {
  if (!enabled()) return;
  if (queue.length < MAX_QUEUE) queue.push({ name, props });
  flushTimer ??= setTimeout(() => {
    flush();
  }, FLUSH_DELAY_MS);
}

/** Sends what's queued when the app goes to the background. Call once at startup. */
export function startAnalytics(): void {
  AppState.addEventListener('change', (state) => {
    if (state === 'background') flush();
  });
  track('app_open');
}

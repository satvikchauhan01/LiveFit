import { AppState } from 'react-native';
import { create } from 'zustand';

import { onSignedIn, useAccountStore } from '@/features/account/accountStore';
import { ApiError, errorMessage } from '@/features/account/apiClient';
import { useProfileStore } from '@/features/profile/profileStore';

import { onLocalChange } from './changes';
import { lastSyncedAt, runSync } from './syncEngine';
import { clearState, markEverythingForUpload, purgeAllTombstones } from './syncRepository';

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error';

type SyncState = {
  status: SyncStatus;
  lastSyncedAt: number | null;
  error: string | null;
  /** Syncs now (or joins the sync already running). */
  syncNow: () => Promise<void>;
  /** Syncs soon: several changes in a row become one sync. */
  requestSync: () => void;
};

/** Called after a sync brings in settings from another device. */
let afterProfileSync: (() => void) | null = null;
export function setAfterProfileSync(callback: () => void): void {
  afterProfileSync = callback;
}

const DEBOUNCE_MS = 3_000;
/** Coming back to the app syncs at most this often. */
const FOREGROUND_MIN_GAP_MS = 60_000;

let running: Promise<void> | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

export const useSyncStore = create<SyncState>()((set, get) => ({
  status: 'idle',
  lastSyncedAt: null,
  error: null,

  syncNow: () => {
    if (useAccountStore.getState().status !== 'signedIn') {
      return Promise.resolve();
    }
    running ??= (async () => {
      set({ status: 'syncing', error: null });
      try {
        const result = await runSync();
        set({ status: 'idle', lastSyncedAt: await lastSyncedAt() });
        if (result.profileChanged) {
          await useProfileStore.getState().load();
          afterProfileSync?.();
        }
      } catch (error) {
        if (error instanceof ApiError && error.isOffline) {
          set({ status: 'offline', error: null });
        } else {
          set({ status: 'error', error: errorMessage(error) });
        }
      } finally {
        running = null;
      }
    })();
    return running;
  },

  requestSync: () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      get().syncNow();
    }, DEBOUNCE_MS);
  },
}));

/** Wires sync to the events that should trigger it. Call once at startup. */
export async function startSyncTriggers(): Promise<void> {
  useSyncStore.setState({ lastSyncedAt: await lastSyncedAt() });

  // Every local change (finished workout, edit, delete, setting) uploads soon after.
  onLocalChange(() => useSyncStore.getState().requestSync());

  // A new sign-in uploads everything on this phone and downloads the account's data.
  onSignedIn(async () => {
    await clearState();
    await markEverythingForUpload();
    await useSyncStore.getState().syncNow();
  });

  // Coming back to the app picks up changes made on other devices.
  AppState.addEventListener('change', (state) => {
    const { lastSyncedAt: last, syncNow } = useSyncStore.getState();
    if (state === 'active' && (!last || Date.now() - last > FOREGROUND_MIN_GAP_MS)) {
      syncNow();
    }
  });

  // Signing out forgets the sync position, so the next account starts fresh.
  useAccountStore.subscribe(async (state, previous) => {
    if (previous.status === 'signedIn' && state.status === 'signedOut') {
      await clearState();
      await purgeAllTombstones();
      useSyncStore.setState({ status: 'idle', lastSyncedAt: null, error: null });
    }
  });

  await useSyncStore.getState().syncNow();
}

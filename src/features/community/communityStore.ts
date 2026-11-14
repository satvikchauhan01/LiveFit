import { create } from 'zustand';

import type { SocialSettingsDoc, Visibility } from '@shared/api';

import { useAccountStore } from '@/features/account/accountStore';

import { communityApi } from './communityApi';

/** Quiet hours are read in the phone's time zone, so it's sent along with them. */
export type SettingsChanges = Partial<SocialSettingsDoc> & { timezone?: string };

type CommunityState = {
  settings: SocialSettingsDoc | null;
  unread: number;
  loadSettings: () => Promise<void>;
  updateSettings: (changes: SettingsChanges) => Promise<void>;
  refreshUnread: () => Promise<void>;
  clearUnread: () => Promise<void>;
};

export const useCommunityStore = create<CommunityState>()((set) => ({
  settings: null,
  unread: 0,

  loadSettings: async () => {
    set({ settings: await communityApi.socialSettings() });
  },

  updateSettings: async (changes) => {
    set({ settings: await communityApi.updateSocialSettings(changes) });
  },

  refreshUnread: async () => {
    const { unread } = await communityApi.inbox();
    set({ unread });
  },

  clearUnread: async () => {
    await communityApi.markInboxRead();
    set({ unread: 0 });
  },
}));

/** True when the community features can be used: signed in with a username. */
export function useCommunityReady(): boolean {
  return useAccountStore((state) => state.status === 'signedIn' && Boolean(state.user?.username));
}

/** The visibility new workouts start with (only you, until you choose otherwise). */
export function defaultVisibility(): Visibility {
  return useCommunityStore.getState().settings?.defaultVisibility ?? 'only_me';
}

import { create } from 'zustand';

import type { Profile } from '@/db/schema';

import { loadProfile, type ProfileChanges, saveProfile } from './profileRepository';

// The database is the source of truth; this store keeps a copy in memory
// so any screen can read the profile instantly and re-render when it changes.

type ProfileState = {
  profile: Profile | null;
  load: () => Promise<void>;
  update: (changes: ProfileChanges) => Promise<void>;
};

export const useProfileStore = create<ProfileState>()((set) => ({
  profile: null,
  load: async () => {
    set({ profile: await loadProfile() });
  },
  update: async (changes) => {
    set({ profile: await saveProfile(changes) });
  },
}));

/**
 * The loaded profile. Only use this below the root layout, which doesn't
 * render any screens until the profile has loaded.
 */
export function useProfile(): Profile {
  const profile = useProfileStore((state) => state.profile);
  if (!profile) {
    throw new Error('useProfile() was called before the profile was loaded.');
  }
  return profile;
}

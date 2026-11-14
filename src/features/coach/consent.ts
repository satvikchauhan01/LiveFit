import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

const KEY = 'livefit.coachConsent';

type ConsentState = {
  /** null until read from storage. */
  given: boolean | null;
  load: () => Promise<void>;
  setGiven: (given: boolean) => Promise<void>;
};

/** Whether the person agreed to send their training summary to the AI coach. */
export const useCoachConsent = create<ConsentState>()((set) => ({
  given: null,
  load: async () => {
    set({ given: (await SecureStore.getItemAsync(KEY)) === 'yes' });
  },
  setGiven: async (given) => {
    if (given) {
      await SecureStore.setItemAsync(KEY, 'yes');
    } else {
      await SecureStore.deleteItemAsync(KEY);
    }
    set({ given });
  },
}));

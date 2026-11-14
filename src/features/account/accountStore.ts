import { create } from 'zustand';

import type { ApiUser, AuthResponse } from '@shared/api';

import { api, onSessionChange, serverConfigured } from './apiClient';
import { clearSession, loadCachedUser, loadRefreshToken, saveSession, saveUser } from './session';

export type AccountStatus = 'loading' | 'signedOut' | 'signedIn';

type AccountState = {
  status: AccountStatus;
  user: ApiUser | null;

  /** At launch: signed in if a refresh token is stored (works offline too). */
  restore: () => Promise<void>;
  signUp: (input: { email: string; password: string; displayName: string }) => Promise<void>;
  signIn: (input: { email: string; password: string }) => Promise<void>;
  signOut: () => Promise<void>;
  /** Fetches the latest account details (e.g. after confirming the email). */
  refreshUser: () => Promise<void>;
  resendVerification: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  updateAccount: (changes: { displayName?: string; isPrivate?: boolean }) => Promise<void>;
  deleteAccount: (password: string) => Promise<void>;
  /** Stores account details another screen fetched (e.g. after choosing a username). */
  setUser: (user: ApiUser) => Promise<void>;
};

type SignInListener = () => void;
const signInListeners = new Set<SignInListener>();
const beforeSignOutTasks = new Set<() => Promise<void>>();

/** Work to do while still signed in, e.g. unregistering this phone for push. */
export function beforeSignOut(task: () => Promise<void>): void {
  beforeSignOutTasks.add(task);
}

/** Sync listens here: a new sign-in means "upload everything on this phone". */
export function onSignedIn(listener: SignInListener): () => void {
  signInListeners.add(listener);
  return () => signInListeners.delete(listener);
}

export const useAccountStore = create<AccountState>()((set, get) => {
  const startSession = async (session: AuthResponse) => {
    await saveSession(session);
    set({ status: 'signedIn', user: session.user });
    signInListeners.forEach((listener) => listener());
  };

  return {
    status: 'loading',
    user: null,

    restore: async () => {
      if (!serverConfigured || !(await loadRefreshToken())) {
        set({ status: 'signedOut', user: null });
        return;
      }
      set({ status: 'signedIn', user: await loadCachedUser() });
      // Refresh details in the background; being offline is fine.
      get()
        .refreshUser()
        .catch(() => {});
    },

    signUp: async (input) => {
      await startSession(
        await api<AuthResponse>('/v1/auth/signup', { method: 'POST', body: input, auth: false }),
      );
    },

    signIn: async (input) => {
      await startSession(
        await api<AuthResponse>('/v1/auth/login', { method: 'POST', body: input, auth: false }),
      );
    },

    signOut: async () => {
      // Best effort, like the logout below.
      await Promise.all([...beforeSignOutTasks].map((task) => task().catch(() => {})));
      const refreshToken = await loadRefreshToken();
      if (refreshToken) {
        // Best effort: if the phone is offline, the token simply expires later.
        await api('/v1/auth/logout', {
          method: 'POST',
          body: { refreshToken },
          auth: false,
        }).catch(() => {});
      }
      await clearSession();
      set({ status: 'signedOut', user: null });
    },

    refreshUser: async () => {
      const { user } = await api<{ user: ApiUser }>('/v1/me');
      await saveUser(user);
      set({ user });
    },

    resendVerification: async () => {
      await api('/v1/auth/resend-verification', { method: 'POST' });
    },

    forgotPassword: async (email) => {
      await api('/v1/auth/forgot-password', { method: 'POST', body: { email }, auth: false });
    },

    changePassword: async (currentPassword, newPassword) => {
      const session = await api<AuthResponse>('/v1/auth/change-password', {
        method: 'POST',
        body: { currentPassword, newPassword },
      });
      await saveSession(session);
      set({ user: session.user });
    },

    updateAccount: async (changes) => {
      const { user } = await api<{ user: ApiUser }>('/v1/me', { method: 'PATCH', body: changes });
      await saveUser(user);
      set({ user });
    },

    deleteAccount: async (password) => {
      await api('/v1/me', { method: 'DELETE', body: { password } });
      await clearSession();
      set({ status: 'signedOut', user: null });
    },

    setUser: async (user) => {
      await saveUser(user);
      set({ user });
    },
  };
});

// Keep the store in step when the API client renews or loses the session.
onSessionChange((event) => {
  if (event.type === 'refreshed') {
    useAccountStore.setState({ status: 'signedIn', user: event.user });
  } else {
    useAccountStore.setState({ status: 'signedOut', user: null });
  }
});

export function useIsSignedIn(): boolean {
  return useAccountStore((state) => state.status === 'signedIn');
}

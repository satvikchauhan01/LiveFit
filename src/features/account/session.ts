import * as SecureStore from 'expo-secure-store';

import type { ApiUser } from '@shared/api';

// Where sign-in lives on the phone:
// - The refresh token goes in the system keystore (expo-secure-store), encrypted
//   with a key that never leaves the phone.
// - The access token only lives in memory; it expires after 15 minutes anyway.
// - The user's details are cached so the app knows who's signed in when offline.

const REFRESH_TOKEN_KEY = 'livefit.refreshToken';
const USER_KEY = 'livefit.user';

let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export async function saveSession(session: {
  accessToken: string;
  refreshToken: string;
  user: ApiUser;
}): Promise<void> {
  accessToken = session.accessToken;
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, session.refreshToken);
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(session.user));
}

export async function saveUser(user: ApiUser): Promise<void> {
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
}

export async function loadRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function loadCachedUser(): Promise<ApiUser | null> {
  const raw = await SecureStore.getItemAsync(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ApiUser;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  accessToken = null;
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  await SecureStore.deleteItemAsync(USER_KEY);
}

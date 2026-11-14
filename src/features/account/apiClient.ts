import type { ApiErrorBody, ApiUser, AuthResponse } from '@shared/api';

import { clearSession, getAccessToken, loadRefreshToken, saveSession } from './session';

/** The server's address, baked in at build time (EXPO_PUBLIC_API_URL). */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/+$/, '');

/** False in builds made without a server address: accounts are hidden then. */
export const serverConfigured = API_URL !== '';

export class ApiError extends Error {
  constructor(
    /** HTTP status, or 0 when the server couldn't be reached. */
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }

  get isOffline(): boolean {
    return this.status === 0;
  }
}

type SessionListener = (event: { type: 'refreshed'; user: ApiUser } | { type: 'ended' }) => void;
const sessionListeners = new Set<SessionListener>();

/** The account store listens here, so it hears about renewed or ended sessions. */
export function onSessionChange(listener: SessionListener): () => void {
  sessionListeners.add(listener);
  return () => sessionListeners.delete(listener);
}

const TIMEOUT_MS = 30_000;

async function send(path: string, init: RequestInit): Promise<Response> {
  if (!serverConfigured) {
    throw new ApiError(0, 'not_configured', 'This version of LiveFit isn’t connected to a server.');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(`${API_URL}${path}`, { ...init, signal: controller.signal });
  } catch {
    throw new ApiError(
      0,
      'offline',
      'Couldn’t reach LiveFit. Check your connection and try again.',
    );
  } finally {
    clearTimeout(timer);
  }
}

async function readError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as ApiErrorBody;
    return new ApiError(response.status, body.error.code, body.error.message);
  } catch {
    return new ApiError(response.status, 'unknown', `The server answered ${response.status}.`);
  }
}

// If several requests find the access token expired at once, they share one refresh.
let refreshing: Promise<void> | null = null;

/** Swaps the stored refresh token for a new access + refresh pair. */
export function refreshSession(): Promise<void> {
  refreshing ??= (async () => {
    try {
      const refreshToken = await loadRefreshToken();
      if (!refreshToken) throw new ApiError(401, 'session_ended', 'Please sign in again.');
      const response = await send('/v1/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!response.ok) {
        const error = await readError(response);
        if (response.status === 401) {
          await clearSession();
          sessionListeners.forEach((listener) => listener({ type: 'ended' }));
        }
        throw error;
      }
      const session = (await response.json()) as AuthResponse;
      await saveSession(session);
      sessionListeners.forEach((listener) => listener({ type: 'refreshed', user: session.user }));
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Send the signed-in user's access token (default true). */
  auth?: boolean;
};

/**
 * Calls the LiveFit server and returns the parsed JSON (or undefined for "204 No
 * Content"). An expired access token is renewed once, transparently.
 */
export async function api<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true } = options;

  const attempt = async () => {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (auth) {
      if (!getAccessToken()) await refreshSession();
      headers.Authorization = `Bearer ${getAccessToken()}`;
    }
    return send(path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  };

  let response = await attempt();
  if (auth && response.status === 401) {
    await refreshSession();
    response = await attempt();
  }
  if (!response.ok) {
    throw await readError(response);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

/** A message that's safe to show the user for any error. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return String(error);
}

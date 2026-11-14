import { create } from 'zustand';

import type { LiveShareStart } from '@shared/api';

import { api, API_URL } from '@/features/account/apiClient';
import { readState, writeState } from '@/features/sync/syncRepository';
import type { TrackPoint } from '@/features/tracking/types';

// Live location sharing: a secret link friends can open in a browser to follow
// a workout as it happens. Positions are posted from the background GPS task,
// with the link's own key, so they keep going with the screen off.

const STATE_KEY = 'liveShare';
const POST_EVERY_MS = 20_000;

export type ActiveLiveShare = LiveShareStart & { workoutId: string };

type LiveShareState = {
  share: ActiveLiveShare | null;
  loaded: boolean;
  load: () => Promise<void>;
};

export const useLiveShareStore = create<LiveShareState>()((set) => ({
  share: null,
  loaded: false,
  load: async () => {
    set({ share: await readShare(), loaded: true });
  },
}));

let cached: ActiveLiveShare | null | undefined;
let lastPostAt = 0;
let posting = false;
let liveDistanceM: number | null = null;

async function readShare(): Promise<ActiveLiveShare | null> {
  if (cached !== undefined) return cached;
  const raw = await readState(STATE_KEY);
  try {
    cached = raw ? (JSON.parse(raw) as ActiveLiveShare) : null;
  } catch {
    cached = null;
  }
  return cached;
}

async function saveShare(share: ActiveLiveShare | null): Promise<void> {
  cached = share;
  await writeState(STATE_KEY, share ? JSON.stringify(share) : '');
  useLiveShareStore.setState({ share, loaded: true });
}

/** Makes a live link for the workout being recorded. */
export async function startLiveShare(
  workoutId: string,
  activity: string,
): Promise<ActiveLiveShare> {
  const started = await api<LiveShareStart>('/v1/live-shares', {
    method: 'POST',
    body: { activity, hours: 12 },
  });
  const share = { ...started, workoutId };
  await saveShare(share);
  lastPostAt = 0;
  return share;
}

/** Stops the link (when the workout ends, or when you choose to). */
export async function endLiveShare(): Promise<void> {
  const share = await readShare();
  if (!share) return;
  await saveShare(null);
  liveDistanceM = null;
  await fetch(`${API_URL}/v1/live-shares/${share.id}/end`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${share.writeKey}` },
  }).catch(() => {});
}

/** The recorder keeps this up to date, so viewers see the distance too. */
export function setLiveDistance(distanceM: number): void {
  liveDistanceM = distanceM;
}

/** Called by the GPS task with new points; posts the newest one every ~20 s. */
export async function postLivePosition(workoutId: string, points: TrackPoint[]): Promise<void> {
  const newest = points[points.length - 1];
  if (!newest || posting || Date.now() - lastPostAt < POST_EVERY_MS) return;
  const share = await readShare();
  if (!share || share.workoutId !== workoutId) return;
  if (Date.now() > share.expiresAt) {
    await saveShare(null);
    return;
  }
  posting = true;
  lastPostAt = Date.now();
  try {
    const response = await fetch(`${API_URL}/v1/live-shares/${share.id}/position`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${share.writeKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lat: newest.lat,
        lng: newest.lng,
        at: newest.t,
        distanceM: liveDistanceM,
      }),
    });
    // Ended elsewhere, or expired: stop trying.
    if (response.status === 401 || response.status === 410) await saveShare(null);
  } catch {
    // Offline for a moment: the next point will try again.
  } finally {
    posting = false;
  }
}

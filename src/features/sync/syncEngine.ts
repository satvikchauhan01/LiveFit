import type { PullResponse, PushRequest, PushResponse } from '@shared/api';

import { api } from '@/features/account/apiClient';

import { adapterFor, docAdapters } from './docAdapters';
import {
  applyWorkoutDoc,
  dirtyWorkouts,
  markWorkoutUploaded,
  pendingDeletes,
  purgeTombstones,
  readState,
  removeWorkoutsLocally,
  toWorkoutDoc,
  writeState,
} from './syncRepository';

const CURSOR_KEY = 'pullCursor';
/** Workouts carry their routes, so a few per request keeps each upload small. */
const WORKOUTS_PER_PUSH = 5;

export type SyncResult = {
  uploaded: number;
  downloaded: number;
  /** Profile settings came in from another device (reload them, reschedule reminders). */
  profileChanged: boolean;
};

/** Uploads everything that changed on this phone. */
async function push(): Promise<number> {
  let uploaded = 0;

  const docs = (await Promise.all(docAdapters().map((adapter) => adapter.collectDirty()))).flat();
  const deletes = await pendingDeletes();
  const workouts = await dirtyWorkouts();

  // The first request also carries the small stuff: settings, exercises, deletes.
  const batches: PushRequest[] = [];
  for (let i = 0; i < Math.max(1, workouts.length); i += WORKOUTS_PER_PUSH) {
    batches.push({
      workouts: [],
      deletedWorkouts: i === 0 ? deletes : [],
      docs: i === 0 ? docs : [],
    });
  }

  for (const [index, batch] of batches.entries()) {
    const slice = workouts.slice(index * WORKOUTS_PER_PUSH, (index + 1) * WORKOUTS_PER_PUSH);
    batch.workouts = await Promise.all(slice.map(toWorkoutDoc));
    if (batch.workouts.length + batch.deletedWorkouts.length + batch.docs.length === 0) continue;

    const response = await api<PushResponse>('/v1/sync/push', { method: 'POST', body: batch });

    const saved = new Set(response.savedWorkoutIds);
    for (const doc of batch.workouts) {
      if (saved.has(doc.id)) {
        await markWorkoutUploaded(doc.id, doc.updatedAt);
        uploaded += 1;
      }
    }
    await purgeTombstones(batch.deletedWorkouts.map((item) => item.id));
    for (const doc of batch.docs) {
      await adapterFor(doc.kind)?.markUploaded(doc);
    }
  }
  return uploaded;
}

/** Downloads everything that changed on the server since the last pull. */
async function pull(): Promise<{ downloaded: number; profileChanged: boolean }> {
  let downloaded = 0;
  let profileChanged = false;
  let cursor = (await readState(CURSOR_KEY)) ?? '0';

  for (;;) {
    const page = await api<PullResponse>(`/v1/sync/pull?cursor=${encodeURIComponent(cursor)}`);

    // Documents first: a workout may use a custom exercise that arrives in the same page.
    for (const doc of page.docs) {
      const changed = (await adapterFor(doc.kind)?.apply(doc)) ?? false;
      if (changed && doc.kind === 'profile') profileChanged = true;
    }
    for (const doc of page.workouts) {
      await applyWorkoutDoc(doc);
      downloaded += 1;
    }
    await removeWorkoutsLocally(page.deletedWorkoutIds);

    // Save the cursor after each page, so a dropped connection resumes where it stopped.
    cursor = page.cursor;
    await writeState(CURSOR_KEY, cursor);
    if (!page.hasMore) break;
  }
  return { downloaded, profileChanged };
}

/**
 * One full sync: push first (so our edits are on the server), then pull.
 * Safe to repeat: every step is idempotent.
 */
export async function runSync(): Promise<SyncResult> {
  const uploaded = await push();
  const { downloaded, profileChanged } = await pull();
  await writeState('lastSyncedAt', String(Date.now()));
  return { uploaded, downloaded, profileChanged };
}

export async function lastSyncedAt(): Promise<number | null> {
  const value = await readState('lastSyncedAt');
  return value ? Number(value) : null;
}

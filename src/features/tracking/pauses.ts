import type { PauseInterval } from './types';

export function openPause<T extends PauseInterval>(pauses: T[]): T | undefined {
  return pauses.find((pause) => pause.endedAt === null);
}

export function isPausedAt(t: number, pauses: PauseInterval[]): boolean {
  return pauses.some(
    (pause) => t >= pause.startedAt && (pause.endedAt === null || t < pause.endedAt),
  );
}

/** How much of the time between `from` and `to` was spent paused. */
export function pausedMsBetween(from: number, to: number, pauses: PauseInterval[]): number {
  let total = 0;
  for (const pause of pauses) {
    const start = Math.max(from, pause.startedAt);
    const end = Math.min(to, pause.endedAt ?? to);
    if (end > start) {
      total += end - start;
    }
  }
  return total;
}

/** Recording time from the start of the workout until `t`, with pauses taken out. */
export function activeMsAt(t: number, startedAt: number, pauses: PauseInterval[]): number {
  return Math.max(0, t - startedAt - pausedMsBetween(startedAt, t, pauses));
}

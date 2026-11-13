import type { TrackPoint } from './types';

// A tiny publish/subscribe channel so the app can show new points live
// without polling the database. The location task publishes; the recorder store subscribes.

type Listener = (workoutId: string, points: TrackPoint[]) => void;

const listeners = new Set<Listener>();

export function subscribeToNewPoints(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function publishNewPoints(workoutId: string, points: TrackPoint[]): void {
  listeners.forEach((listener) => listener(workoutId, points));
}

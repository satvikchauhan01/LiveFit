// A tiny signal: "something that should be synced just changed on this phone".
// The database code raises it; the sync engine listens and schedules an upload.
// Keeping it separate means the database code doesn't depend on the sync code.

type Listener = () => void;

const listeners = new Set<Listener>();

export function onLocalChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifyLocalChange(): void {
  listeners.forEach((listener) => listener());
}

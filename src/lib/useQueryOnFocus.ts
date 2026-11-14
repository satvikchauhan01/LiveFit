import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

/**
 * Runs a database query whenever the screen comes into view (and again when
 * `load` changes), so returning to a screen shows what changed elsewhere.
 * Returns null until the first result arrives. Keep `load` stable (useCallback
 * or a module-level function), or it runs on every render.
 */
export function useQueryOnFocus<T>(load: () => Promise<T>): T | null {
  const [value, setValue] = useState<T | null>(null);
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      load()
        .then((result) => {
          if (!cancelled) setValue(result);
        })
        .catch((error: unknown) => console.warn('[query] failed', error));
      return () => {
        // A newer query (or leaving the screen) makes this result stale.
        cancelled = true;
      };
    }, [load]),
  );
  return value;
}

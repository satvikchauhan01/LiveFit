import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { errorMessage } from '@/features/account/apiClient';

export type Remote<T> = {
  data: T | null;
  error: string | null;
  loading: boolean;
  /** Fetches again (after a change, or from "Try again"). */
  reload: () => void;
  /** Replaces the data with a newer copy the server sent back (e.g. after a kudos). */
  setData: (data: T) => void;
};

/**
 * Loads something from the server whenever the screen comes into view, and
 * keeps track of loading and errors. Keep `load` stable (useCallback).
 */
export function useRemote<T>(load: () => Promise<T>): Remote<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      load()
        .then((result) => {
          if (cancelled) return;
          setData(result);
          setError(null);
        })
        .catch((failure: unknown) => {
          if (!cancelled) setError(errorMessage(failure));
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
      // `version` is how reload() asks for a fresh copy.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load, version]),
  );

  const reload = useCallback(() => setVersion((value) => value + 1), []);
  return { data, error, loading, reload, setData };
}

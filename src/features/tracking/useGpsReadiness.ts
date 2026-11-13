import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

export type GpsReadiness =
  | { state: 'checking' }
  | { state: 'services-off' }
  | { state: 'no-permission'; canAskAgain: boolean }
  | { state: 'watching'; accuracyM: number | null }
  | { state: 'error'; message: string };

/**
 * Watches the GPS before a workout starts, so the user can see when the fix is
 * good enough. Checks again when the app comes back from system settings.
 */
export function useGpsReadiness() {
  const [readiness, setReadiness] = useState<GpsReadiness>({ state: 'checking' });
  const [attempt, setAttempt] = useState(0);

  const recheck = useCallback(() => setAttempt((count) => count + 1), []);

  useEffect(() => {
    let cancelled = false;
    let subscription: Location.LocationSubscription | undefined;

    const watch = async () => {
      if (!(await Location.hasServicesEnabledAsync())) {
        if (!cancelled) setReadiness({ state: 'services-off' });
        return;
      }
      const permission = await Location.getForegroundPermissionsAsync();
      if (cancelled) return;
      if (!permission.granted) {
        setReadiness({ state: 'no-permission', canAskAgain: permission.canAskAgain });
        return;
      }

      setReadiness((current) =>
        current.state === 'watching' ? current : { state: 'watching', accuracyM: null },
      );
      const started = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 0 },
        (location) => setReadiness({ state: 'watching', accuracyM: location.coords.accuracy }),
      );
      if (cancelled) {
        started.remove();
      } else {
        subscription = started;
      }
    };

    watch().catch((error: unknown) => {
      if (!cancelled) {
        setReadiness({
          state: 'error',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    });

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [attempt]);

  // Coming back from system settings may have changed everything.
  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') recheck();
    });
    return () => listener.remove();
  }, [recheck]);

  return { readiness, recheck };
}

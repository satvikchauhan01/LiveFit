import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/**
 * The current time, refreshed every `intervalMs` while the app is on screen.
 * The clock stops while the app is in the background, so a screen-off workout
 * doesn't spend battery redrawing a screen nobody can see.
 */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const tick = () => setNow(Date.now());
    const startTicking = () => {
      timer ??= setInterval(tick, intervalMs);
    };
    const stopTicking = () => {
      clearInterval(timer);
      timer = undefined;
    };

    if (AppState.currentState !== 'background') {
      startTicking();
    }
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        tick();
        startTicking();
      } else if (state === 'background') {
        stopTicking();
      }
    });

    return () => {
      stopTicking();
      subscription.remove();
    };
  }, [intervalMs]);

  return now;
}

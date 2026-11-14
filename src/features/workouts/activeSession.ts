import type { ActivityType } from '@/db/schema';
import { useRecorderStore } from '@/features/recorder/recorderStore';
import { useStrengthStore } from '@/features/strength/strengthStore';

export type ActiveSession = {
  type: ActivityType;
  /** The screen to return to. */
  route: '/recording' | '/strength';
};

/** The workout in progress, of either kind. Only one can run at a time. */
export function useActiveSession(): ActiveSession | null {
  const gpsType = useRecorderStore((state) =>
    state.phase === 'live' ? (state.workout?.type ?? null) : null,
  );
  const strengthActive = useStrengthStore((state) => state.workout !== null);

  if (gpsType) return { type: gpsType, route: '/recording' };
  if (strengthActive) return { type: 'strength', route: '/strength' };
  return null;
}

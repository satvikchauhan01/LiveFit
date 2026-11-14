import { router } from 'expo-router';

import { startStrengthWorkout } from '@/features/strength/startStrengthWorkout';
import { useStrengthStore } from '@/features/strength/strengthStore';

import type { PlanSession, RoutineItem } from './plans';

/** Starts a strength workout already filled from a routine or plan session. */
export async function startFromRoutine(items: RoutineItem[]): Promise<void> {
  if (!(await startStrengthWorkout())) return;
  const store = useStrengthStore.getState();
  if (store.exercises.length === 0) {
    await store.addRoutine(items);
  }
  router.push('/strength');
}

/** Opens the right screen for a plan session: GPS for runs, a filled-in workout for strength. */
export async function startPlanSession(session: PlanSession): Promise<void> {
  if (session.type === 'strength') {
    await startFromRoutine(session.routine ?? []);
    return;
  }
  router.push({ pathname: '/record/ready', params: { activity: session.type } });
}

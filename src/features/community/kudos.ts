import { Alert } from 'react-native';

import type { SharedWorkout } from '@shared/api';

import { errorMessage } from '@/features/account/apiClient';

import { communityApi } from './communityApi';

/**
 * Gives (or takes back) kudos. The change shows straight away; if the server
 * refuses, the old state comes back.
 */
export async function toggleKudos(
  workout: SharedWorkout,
  update: (workout: SharedWorkout) => void,
): Promise<void> {
  const optimistic: SharedWorkout = {
    ...workout,
    hasKudoed: !workout.hasKudoed,
    kudos: workout.kudos + (workout.hasKudoed ? -1 : 1),
  };
  update(optimistic);
  try {
    update(
      workout.hasKudoed
        ? await communityApi.takeKudos(workout.id)
        : await communityApi.giveKudos(workout.id),
    );
  } catch (error) {
    update(workout);
    Alert.alert('Couldn’t send kudos', errorMessage(error));
  }
}

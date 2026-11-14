import type { LocationObject } from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { postLivePosition } from '@/features/live/liveShare';
import { getActiveGpsWorkoutId, insertTrackPoints } from '@/features/workouts/workoutRepository';

import { publishNewPoints } from './trackingEvents';
import type { TrackPoint } from './types';

export const LOCATION_TASK = 'livefit-location-updates';

type LocationTaskData = {
  locations: LocationObject[];
};

function toTrackPoint(location: LocationObject): TrackPoint {
  const { coords } = location;
  return {
    t: location.timestamp,
    lat: coords.latitude,
    lng: coords.longitude,
    alt: coords.altitude,
    accuracy: coords.accuracy,
    speed: coords.speed,
    mocked: location.mocked ?? false,
  };
}

// This must run when the JS bundle loads, not inside a component:
// if Android restarts the app in the background, no screens are mounted,
// but the task still needs a handler. The root layout imports this file for that reason.
TaskManager.defineTask<LocationTaskData>(LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.warn('[location task]', error.message);
    return;
  }
  const locations = data?.locations ?? [];
  if (locations.length === 0) {
    return;
  }

  // Read from the database rather than memory: after a background restart,
  // the database is the only thing that knows which workout is running.
  const workoutId = await getActiveGpsWorkoutId();
  if (!workoutId) {
    return; // updates can still arrive for a moment after a workout ends
  }

  const points = locations.map(toTrackPoint);
  // Every point is saved, paused or not; the pipeline decides what counts.
  // Save first, then tell the UI: if the app dies right after this line, the points are safe.
  await insertTrackPoints(workoutId, points);
  publishNewPoints(workoutId, points);
  // If a live link is on, friends following it get the new position.
  await postLivePosition(workoutId, points);
});

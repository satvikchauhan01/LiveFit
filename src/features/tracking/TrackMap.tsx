import { colors } from '@/theme/tokens';

import { lastPathPoint, type WorkoutTrack } from './pipeline';
import type { RouteMarker } from './RoutePreview';
import { RouteMap } from './RouteMap';

type Props = {
  track: WorkoutTrack;
  height?: number;
  /** While recording: mark where you are now instead of where you finished. */
  live?: boolean;
};

/** The cleaned-up route of a workout: one line per stretch between pauses. */
export function TrackMap({ track, height, live = false }: Props) {
  const lines = track.segments.map((segment) => ({
    points: segment,
    color: colors.accent,
    strokeWidth: 4,
  }));

  const first = track.segments[0]?.[0];
  const last = lastPathPoint(track);
  const markers: RouteMarker[] = [];
  if (first) {
    markers.push({ point: first, color: colors.success });
  }
  if (last && last !== first) {
    markers.push(
      live ? { point: last, color: colors.text, radius: 8 } : { point: last, color: colors.danger },
    );
  }

  return (
    <RouteMap
      lines={lines}
      markers={markers}
      height={height}
      follow={live}
      emptyText={live ? 'Waiting for a GPS fix…' : 'No route was recorded.'}
    />
  );
}

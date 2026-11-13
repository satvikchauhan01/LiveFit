export type LatLng = {
  lat: number;
  lng: number;
};

export type TrackPoint = LatLng & {
  /** Unix time in milliseconds. */
  t: number;
  /** Altitude in metres, if the device reported one. */
  alt: number | null;
  /** Horizontal accuracy radius in metres (smaller is better). */
  accuracy: number | null;
  /** Speed in metres per second, as reported by the GPS chip. */
  speed: number | null;
  /** True when the position came from a mock/spoofing provider. */
  mocked: boolean;
};

/** A stretch of time when recording was paused. `endedAt` is null while still paused. */
export type PauseInterval = {
  startedAt: number;
  endedAt: number | null;
};

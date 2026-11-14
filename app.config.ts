import type { ConfigContext, ExpoConfig } from 'expo/config';

// app.json holds the fixed settings; this file adds the ones that come from the
// environment, so keys stay out of git. Put them in .env.local (local builds) or
// as EAS environment variables (cloud builds).

export default ({ config }: ConfigContext): ExpoConfig => {
  const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
  return {
    ...(config as ExpoConfig),
    android: {
      ...config.android,
      // Without a key the app falls back to drawing routes as lines.
      ...(googleMapsApiKey
        ? { config: { ...config.android?.config, googleMaps: { apiKey: googleMapsApiKey } } }
        : {}),
    },
    // iOS uses Apple Maps, which needs no key.
  };
};

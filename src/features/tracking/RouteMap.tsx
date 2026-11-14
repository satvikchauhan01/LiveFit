import Constants from 'expo-constants';
import { useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';

import { colors, radius } from '@/theme/tokens';

import { type RouteLine, type RouteMarker, RoutePreview } from './RoutePreview';

/** True when the build has a Google Maps key; the map crashes on Android without one. */
export const mapsAvailable = Boolean(
  Platform.OS === 'android'
    ? Constants.expoConfig?.android?.config?.googleMaps?.apiKey
    : Platform.OS === 'ios',
);

// A dark map to match the app: muted land, darker water, quiet labels.
const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#16191B' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#9AA3A0' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0B0D0E' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2A2F33' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0B0D0E' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];

type Props = {
  lines: RouteLine[];
  markers?: RouteMarker[];
  height?: number;
  emptyText?: string;
  /** While recording: keep the newest point in view instead of fitting the whole route once. */
  follow?: boolean;
};

/**
 * The route on a street map (Google Maps), or drawn as plain lines when the
 * build has no Maps key. Same props either way, so screens don't need to care.
 */
export function RouteMap({ lines, markers = [], height = 260, emptyText, follow = false }: Props) {
  const map = useRef<MapView>(null);
  const coordinates = lines
    .flatMap((line) => line.points)
    .map((point) => ({ latitude: point.lat, longitude: point.lng }));

  if (!mapsAvailable || coordinates.length === 0) {
    return <RoutePreview lines={lines} markers={markers} height={height} emptyText={emptyText} />;
  }

  const fit = () => {
    if (follow) {
      const last = coordinates[coordinates.length - 1];
      map.current?.animateCamera({ center: last, zoom: 16 }, { duration: 300 });
    } else {
      map.current?.fitToCoordinates(coordinates, {
        edgePadding: { top: 32, right: 32, bottom: 32, left: 32 },
        animated: false,
      });
    }
  };

  return (
    <View style={[styles.container, { height }]}>
      <MapView
        ref={map}
        style={StyleSheet.absoluteFill}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        customMapStyle={DARK_MAP_STYLE}
        onMapReady={fit}
        onLayout={fit}
        toolbarEnabled={false}
        showsPointsOfInterests={false}
        accessibilityLabel="Route map"
      >
        {lines.map((line, index) =>
          line.points.length > 1 ? (
            <Polyline
              key={index}
              coordinates={line.points.map((point) => ({
                latitude: point.lat,
                longitude: point.lng,
              }))}
              strokeColor={line.color}
              strokeWidth={line.strokeWidth}
              lineJoin="round"
              lineCap="round"
            />
          ) : null,
        )}
        {markers.map((marker, index) => (
          <Marker
            key={index}
            coordinate={{ latitude: marker.point.lat, longitude: marker.point.lng }}
            pinColor={marker.color}
            tracksViewChanges={false}
          />
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
});

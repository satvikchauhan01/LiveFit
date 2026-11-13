import { useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';

import { colors, fontSize, radius } from '@/theme/tokens';

import type { LatLng } from './types';

export type RouteLine = {
  points: LatLng[];
  color: string;
  strokeWidth: number;
};

export type RouteMarker = {
  point: LatLng;
  color: string;
  radius?: number;
};

type Props = {
  lines: RouteLine[];
  markers?: RouteMarker[];
  height?: number;
  emptyText?: string;
};

const PADDING = 16;

/**
 * Draws routes as plain lines, without map tiles. A street map needs a map
 * provider (and on Android a Google Maps API key); this works offline meanwhile.
 */
export function RoutePreview({
  lines,
  markers = [],
  height = 260,
  emptyText = 'No route to show yet.',
}: Props) {
  const [width, setWidth] = useState(0);
  const allPoints = [...lines.flatMap((line) => line.points), ...markers.map((m) => m.point)];

  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);

  if (allPoints.length === 0) {
    return (
      <View style={[styles.container, styles.empty, { height }]}>
        <Text style={styles.emptyText}>{emptyText}</Text>
      </View>
    );
  }

  const project = width > 0 ? makeProjection(allPoints, width, height) : null;

  return (
    <View
      style={[styles.container, { height }]}
      onLayout={onLayout}
      accessible
      accessibilityLabel="Route drawing"
    >
      {project && (
        <Svg width={width} height={height}>
          {lines.map((line, index) =>
            line.points.length > 1 ? (
              <Polyline
                key={index}
                points={line.points.map((p) => project(p).join(',')).join(' ')}
                fill="none"
                stroke={line.color}
                strokeWidth={line.strokeWidth}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ) : null,
          )}
          {markers.map((marker, index) => {
            const [cx, cy] = project(marker.point);
            return (
              <Circle
                key={index}
                cx={cx}
                cy={cy}
                r={marker.radius ?? 6}
                fill={marker.color}
                stroke={colors.surface}
                strokeWidth={2}
              />
            );
          })}
        </Svg>
      )}
    </View>
  );
}

/**
 * Turns lat/lng into x/y pixels that fit the box, north up.
 * Longitude is squeezed by cos(latitude) so shapes aren't stretched sideways
 * (one degree of longitude gets shorter the further you are from the equator).
 */
function makeProjection(points: LatLng[], width: number, height: number) {
  const meanLat = points.reduce((sum, p) => sum + p.lat, 0) / points.length;
  const lngScale = Math.cos((meanLat * Math.PI) / 180);

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    const x = p.lng * lngScale;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, p.lat);
    maxY = Math.max(maxY, p.lat);
  }

  const spanX = Math.max(maxX - minX, 1e-9);
  const spanY = Math.max(maxY - minY, 1e-9);
  const scale = Math.min((width - PADDING * 2) / spanX, (height - PADDING * 2) / spanY);
  const offsetX = (width - spanX * scale) / 2;
  const offsetY = (height - spanY * scale) / 2;

  return (p: LatLng): [number, number] => [
    offsetX + (p.lng * lngScale - minX) * scale,
    offsetY + (maxY - p.lat) * scale,
  ];
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: fontSize.body,
  },
});

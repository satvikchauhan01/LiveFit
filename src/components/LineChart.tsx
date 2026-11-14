import { useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';

import { colors } from '@/theme/tokens';

type Props = {
  values: number[];
  height?: number;
  /** For pace, lower is better: draw it upside down so "up" always means faster. */
  invert?: boolean;
  accessibilityLabel: string;
};

const PADDING = 8;

/** A trend line over the given values, oldest first. */
export function LineChart({ values, height = 120, invert = false, accessibilityLabel }: Props) {
  const [width, setWidth] = useState(0);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 1e-9);

  const point = (value: number, index: number): [number, number] => {
    const x =
      values.length > 1
        ? PADDING + (index / (values.length - 1)) * (width - PADDING * 2)
        : width / 2;
    const share = (value - min) / span;
    const y = PADDING + (invert ? share : 1 - share) * (height - PADDING * 2);
    return [x, y];
  };

  const points = values.map(point);
  const last = points[points.length - 1];

  return (
    <View
      style={[styles.container, { height }]}
      onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
      accessible
      accessibilityLabel={accessibilityLabel}
    >
      {width > 0 && values.length > 0 && (
        <Svg width={width} height={height}>
          <Polyline
            points={points.map(([x, y]) => `${x},${y}`).join(' ')}
            fill="none"
            stroke={colors.accent}
            strokeWidth={3}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {last && <Circle cx={last[0]} cy={last[1]} r={5} fill={colors.accent} />}
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
});

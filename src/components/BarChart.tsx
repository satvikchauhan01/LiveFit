import { useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';

import { colors, fontSize } from '@/theme/tokens';

export type Bar = { label: string; value: number; highlight?: boolean };

type Props = {
  bars: Bar[];
  height?: number;
  /** Text read by screen readers, e.g. "Distance per week for the last 12 weeks". */
  accessibilityLabel: string;
  /** How a value is written in the screen-reader summary. */
  formatValue?: (value: number) => string;
};

const LABEL_HEIGHT = 18;

/** Simple vertical bars, drawn with SVG. The highlighted bar (e.g. this week) is lime. */
export function BarChart({ bars, height = 160, accessibilityLabel, formatValue = String }: Props) {
  const [width, setWidth] = useState(0);
  const maxValue = Math.max(1, ...bars.map((bar) => bar.value));
  const chartHeight = height - LABEL_HEIGHT;
  const slot = bars.length > 0 ? width / bars.length : 0;
  const barWidth = Math.max(4, slot * 0.6);

  const summary = bars.map((bar) => `${bar.label}: ${formatValue(bar.value)}`).join(', ');

  return (
    <View
      style={[styles.container, { height }]}
      onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
      accessible
      accessibilityLabel={`${accessibilityLabel}. ${summary}`}
    >
      {width > 0 && (
        <Svg width={width} height={height}>
          {bars.map((bar, index) => {
            const barHeight = (bar.value / maxValue) * (chartHeight - 4);
            const x = index * slot + (slot - barWidth) / 2;
            return (
              <Rect
                key={index}
                x={x}
                y={chartHeight - barHeight}
                width={barWidth}
                height={Math.max(bar.value > 0 ? 2 : 0, barHeight)}
                rx={3}
                fill={bar.highlight ? colors.accent : colors.surfaceRaised}
              />
            );
          })}
          {bars.map((bar, index) =>
            // Every label when there's room, otherwise every other one.
            bars.length <= 8 || index % 2 === bars.length % 2 ? (
              <SvgText
                key={`label-${index}`}
                x={index * slot + slot / 2}
                y={height - 4}
                fontSize={fontSize.caption - 2}
                fill={colors.textMuted}
                textAnchor="middle"
              >
                {bar.label}
              </SvgText>
            ) : null,
          )}
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

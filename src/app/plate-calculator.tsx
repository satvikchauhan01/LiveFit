import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { useProfile } from '@/features/profile/profileStore';
import { BARS, PLATES, platesFor } from '@/features/progress/strengthMath';
import { colors, radius, spacing } from '@/theme/tokens';

/** Which plates to load on each side of the bar for a target weight. */
export default function PlateCalculatorScreen() {
  const unit = useProfile().weightUnit;
  const [target, setTarget] = useState(unit === 'kg' ? '60' : '135');
  const [bar, setBar] = useState(BARS[unit][0]);

  const value = Number(target.replace(',', '.'));
  const valid = Number.isFinite(value) && value >= bar;
  const load = valid ? platesFor(value, bar, PLATES[unit]) : null;

  return (
    <Screen edges={['bottom']}>
      <TextField
        label="Target weight"
        value={target}
        onChangeText={setTarget}
        keyboardType="decimal-pad"
        suffix={unit}
        error={!valid && target !== '' ? `At least the bar (${bar} ${unit}).` : undefined}
      />
      <View style={styles.group}>
        <AppText variant="label" tone="muted">
          Bar
        </AppText>
        <View style={styles.chips}>
          {BARS[unit].map((weight) => (
            <Chip
              key={weight}
              label={`${weight} ${unit}`}
              selected={bar === weight}
              onPress={() => setBar(weight)}
            />
          ))}
        </View>
      </View>

      {load && (
        <Card>
          <AppText variant="label" tone="muted">
            On each side
          </AppText>
          {load.perSide.length === 0 ? (
            <AppText>Just the bar.</AppText>
          ) : (
            <View
              style={styles.plates}
              accessible
              accessibilityLabel={`Each side: ${load.perSide.join(', ')} ${unit}`}
            >
              {load.perSide.map((plate, index) => (
                <View
                  key={index}
                  style={[styles.plate, { height: 40 + (plate / PLATES[unit][0]) * 60 }]}
                >
                  <AppText variant="caption" style={styles.plateText}>
                    {plate}
                  </AppText>
                </View>
              ))}
            </View>
          )}
          <AppText tone={Math.abs(load.total - value) < 0.01 ? 'accent' : 'warning'}>
            {Math.abs(load.total - value) < 0.01
              ? `Total ${load.total} ${unit}`
              : `Closest with standard plates: ${load.total} ${unit}`}
          </AppText>
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  plates: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  plate: {
    minWidth: 28,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plateText: {
    color: colors.textOnAccent,
    fontWeight: '700',
  },
});

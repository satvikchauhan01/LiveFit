import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { SegmentedControl } from '@/components/SegmentedControl';
import { OnboardingStep } from '@/features/onboarding/OnboardingStep';
import { useProfile, useProfileStore } from '@/features/profile/profileStore';
import type { DistanceUnit, WeightUnit } from '@/lib/units';
import { spacing } from '@/theme/tokens';

export default function UnitsScreen() {
  const profile = useProfile();
  const update = useProfileStore((state) => state.update);
  const [distanceUnit, setDistanceUnit] = useState<DistanceUnit>(profile.distanceUnit);
  const [weightUnit, setWeightUnit] = useState<WeightUnit>(profile.weightUnit);
  const [busy, setBusy] = useState(false);

  const handleContinue = async () => {
    setBusy(true);
    try {
      await update({ distanceUnit, weightUnit });
      router.push('/onboarding/body');
    } finally {
      setBusy(false);
    }
  };

  return (
    <OnboardingStep
      step={1}
      title="Pick your units"
      description="You can change these any time in Profile."
      footer={<Button label="Continue" onPress={handleContinue} disabled={busy} />}
    >
      <View style={styles.group}>
        <AppText variant="label" tone="muted">
          Distance
        </AppText>
        <SegmentedControl
          accessibilityLabel="Distance unit"
          options={[
            { value: 'km', label: 'Kilometres' },
            { value: 'mi', label: 'Miles' },
          ]}
          value={distanceUnit}
          onChange={setDistanceUnit}
        />
      </View>
      <View style={styles.group}>
        <AppText variant="label" tone="muted">
          Weight
        </AppText>
        <SegmentedControl
          accessibilityLabel="Weight unit"
          options={[
            { value: 'kg', label: 'Kilograms' },
            { value: 'lb', label: 'Pounds' },
          ]}
          value={weightUnit}
          onChange={setWeightUnit}
        />
      </View>
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: spacing.sm,
  },
});

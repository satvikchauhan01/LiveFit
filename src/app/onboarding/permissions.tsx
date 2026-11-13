import * as Location from 'expo-location';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { OnboardingStep } from '@/features/onboarding/OnboardingStep';
import { useProfileStore } from '@/features/profile/profileStore';
import { colors, radius, spacing } from '@/theme/tokens';

// A "permission primer": explain why before the system dialog appears.
// People are far more likely to say yes when they know what it's for,
// and Android only lets an app show the system dialog a limited number of times.

export default function PermissionsScreen() {
  const update = useProfileStore((state) => state.update);
  const [busy, setBusy] = useState(false);

  // Marking onboarding as done flips the guard in the root layout,
  // which moves the user to the tabs. No manual navigation needed.
  const finish = () => update({ onboardedAt: Date.now() });

  const handleAllow = async () => {
    setBusy(true);
    try {
      await Location.requestForegroundPermissionsAsync();
    } finally {
      // Whatever they chose, onboarding is complete. Strength logging works without location.
      await finish();
      setBusy(false);
    }
  };

  const handleSkip = async () => {
    setBusy(true);
    try {
      await finish();
    } finally {
      setBusy(false);
    }
  };

  return (
    <OnboardingStep
      step={3}
      title="Location for your routes"
      description="LiveFit uses GPS to measure distance and pace and to draw your route on runs and walks."
      footer={
        <>
          <Button label="Allow location" onPress={handleAllow} disabled={busy} />
          <Button label="Not now" variant="ghost" onPress={handleSkip} disabled={busy} />
        </>
      }
    >
      <View style={styles.iconCircle}>
        <Icon name="navigate" size={36} color={colors.accent} />
      </View>
      <View style={styles.points}>
        <AppText>• Only while you’re recording a workout</AppText>
        <AppText>• Your routes stay on this phone</AppText>
        <AppText>• Strength workouts don’t need it</AppText>
      </View>
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.md,
  },
  points: {
    gap: spacing.sm,
  },
});

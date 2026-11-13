import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Icon, type IconName } from '@/components/Icon';
import { TextField } from '@/components/TextField';
import { OnboardingStep } from '@/features/onboarding/OnboardingStep';
import { useProfile, useProfileStore } from '@/features/profile/profileStore';
import { colors, spacing } from '@/theme/tokens';

const HIGHLIGHTS: { icon: IconName; text: string }[] = [
  { icon: 'barbell', text: 'Runs, walks and gym sessions in one place' },
  { icon: 'cloud-offline', text: 'Works offline. No account needed' },
  { icon: 'lock-closed', text: 'Private by default. Your data stays on this phone' },
];

export default function WelcomeScreen() {
  const profile = useProfile();
  const update = useProfileStore((state) => state.update);
  const [name, setName] = useState(profile.displayName);
  const [busy, setBusy] = useState(false);

  const handleContinue = async () => {
    setBusy(true);
    try {
      await update({ displayName: name.trim() });
      router.push('/onboarding/units');
    } finally {
      setBusy(false);
    }
  };

  return (
    <OnboardingStep
      title="Welcome to LiveFit"
      description="Track your fitness. Challenge yourself. Grow together."
      footer={<Button label="Get started" onPress={handleContinue} disabled={busy} />}
    >
      <View style={styles.highlights}>
        {HIGHLIGHTS.map((item) => (
          <View key={item.text} style={styles.highlight}>
            <Icon name={item.icon} color={colors.accent} />
            <AppText style={styles.highlightText}>{item.text}</AppText>
          </View>
        ))}
      </View>
      <TextField
        label="What should we call you?"
        placeholder="Your first name (optional)"
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
        autoComplete="given-name"
        returnKeyType="done"
        maxLength={40}
      />
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  highlights: {
    gap: spacing.md,
    marginVertical: spacing.md,
  },
  highlight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  highlightText: {
    flex: 1,
  },
});

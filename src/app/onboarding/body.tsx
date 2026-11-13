import { router } from 'expo-router';
import { useState } from 'react';

import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { OnboardingStep } from '@/features/onboarding/OnboardingStep';
import { useProfile, useProfileStore } from '@/features/profile/profileStore';
import { parseWeightInput } from '@/features/profile/weight';
import { fromKg } from '@/lib/units';

export default function BodyScreen() {
  const profile = useProfile();
  const update = useProfileStore((state) => state.update);
  const [text, setText] = useState(
    profile.weightKg !== null ? fromKg(profile.weightKg, profile.weightUnit).toFixed(1) : '',
  );
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  const next = () => router.push('/onboarding/permissions');

  const handleContinue = async () => {
    const result = parseWeightInput(text, profile.weightUnit);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setBusy(true);
    try {
      await update({ weightKg: result.kg });
      next();
    } finally {
      setBusy(false);
    }
  };

  return (
    <OnboardingStep
      step={2}
      title="Your weight"
      description="Only used to estimate calories burned. It stays on this phone, and you can skip it."
      footer={
        <>
          <Button label="Continue" onPress={handleContinue} disabled={busy} />
          <Button label="Skip" variant="ghost" onPress={next} disabled={busy} />
        </>
      }
    >
      <TextField
        label="Weight"
        placeholder={profile.weightUnit === 'kg' ? 'e.g. 70' : 'e.g. 155'}
        suffix={profile.weightUnit}
        keyboardType="decimal-pad"
        value={text}
        onChangeText={(value) => {
          setText(value);
          setError(undefined);
        }}
        error={error}
        maxLength={6}
      />
    </OnboardingStep>
  );
}

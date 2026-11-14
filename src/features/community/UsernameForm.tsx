import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { useAccountStore } from '@/features/account/accountStore';
import { errorMessage } from '@/features/account/apiClient';
import { spacing } from '@/theme/tokens';

import { communityApi } from './communityApi';

type Props = {
  buttonLabel?: string;
  onDone?: () => void;
};

const PATTERN = /^[a-z0-9_.]{3,20}$/;

/** Picks (or changes) the @username people find you by. */
export function UsernameForm({ buttonLabel = 'Save username', onDone }: Props) {
  const current = useAccountStore((state) => state.user?.username ?? '');
  const setUser = useAccountStore((state) => state.setUser);
  const [value, setValue] = useState(current);
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  const cleaned = value.trim().toLowerCase().replace(/^@/, '');
  const valid = PATTERN.test(cleaned);

  const save = async () => {
    setSaving(true);
    setError(undefined);
    try {
      const { user } = await communityApi.setUsername(cleaned);
      await setUser(user);
      onDone?.();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ gap: spacing.md }}>
      <TextField
        label="Username"
        value={value}
        onChangeText={setValue}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username"
        maxLength={21}
        hint="3–20 letters, numbers, dots or underscores. People can find you by it."
        error={error ?? (cleaned.length > 0 && !valid ? 'That username isn’t allowed.' : undefined)}
      />
      <Button
        label={saving ? 'Saving…' : buttonLabel}
        onPress={save}
        disabled={!valid || saving || cleaned === current}
      />
    </View>
  );
}

import { router } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { useAccountStore } from '@/features/account/accountStore';
import { errorMessage } from '@/features/account/apiClient';

const MIN_PASSWORD_LENGTH = 8;

export default function ChangePasswordScreen() {
  const changePassword = useAccountStore((state) => state.changePassword);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(undefined);
    try {
      await changePassword(current, next);
      Alert.alert('Password changed', 'Other devices have been signed out.');
      router.back();
    } catch (failure) {
      setError(errorMessage(failure));
      setBusy(false);
    }
  };

  return (
    <Screen edges={['bottom']}>
      <TextField
        label="Current password"
        value={current}
        onChangeText={setCurrent}
        secureTextEntry
        autoComplete="current-password"
      />
      <TextField
        label="New password"
        value={next}
        onChangeText={setNext}
        secureTextEntry
        autoComplete="new-password"
        hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
        error={error}
      />
      <Button
        label={busy ? 'Saving…' : 'Change password'}
        onPress={submit}
        disabled={busy || !current || next.length < MIN_PASSWORD_LENGTH}
      />
    </Screen>
  );
}

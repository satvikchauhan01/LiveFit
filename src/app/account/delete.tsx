import { router } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { useAccountStore } from '@/features/account/accountStore';
import { errorMessage } from '@/features/account/apiClient';

export default function DeleteAccountScreen() {
  const deleteAccount = useAccountStore((state) => state.deleteAccount);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  const submit = () =>
    Alert.alert('Delete your account?', 'This can’t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          setError(undefined);
          try {
            await deleteAccount(password);
            Alert.alert(
              'Account deleted',
              'Your account and everything on the server are gone. Workouts on this phone stay until you delete them or uninstall LiveFit.',
            );
            router.dismissAll();
            router.back();
          } catch (failure) {
            setError(errorMessage(failure));
            setBusy(false);
          }
        },
      },
    ]);

  return (
    <Screen edges={['bottom']}>
      <Card>
        <AppText variant="title">This deletes everything on the server</AppText>
        <AppText tone="muted">
          Your account, every synced workout and route, your settings and (once community features
          are on) your profile, follows, comments and club memberships are permanently deleted. It
          can’t be undone.
        </AppText>
      </Card>
      <TextField
        label="Enter your password to confirm"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        error={error}
      />
      <Button
        label={busy ? 'Deleting…' : 'Delete my account'}
        variant="danger"
        onPress={submit}
        disabled={busy || !password}
      />
    </Screen>
  );
}

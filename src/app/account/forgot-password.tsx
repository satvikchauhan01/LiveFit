import { useState } from 'react';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { useAccountStore } from '@/features/account/accountStore';
import { errorMessage } from '@/features/account/apiClient';

export default function ForgotPasswordScreen() {
  const forgotPassword = useAccountStore((state) => state.forgotPassword);
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(undefined);
    try {
      await forgotPassword(email.trim());
      setSent(true);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <Screen edges={['bottom']}>
        <Card>
          <AppText variant="title">Check your email</AppText>
          <AppText tone="muted">
            If there’s an account for {email.trim()}, we’ve sent a link to choose a new password. It
            works for one hour. Then come back and sign in.
          </AppText>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen edges={['bottom']}>
      <AppText tone="muted">
        Enter the email you signed up with, and we’ll send you a link to choose a new password.
      </AppText>
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        error={error}
      />
      <Button label={busy ? 'Sending…' : 'Send link'} onPress={submit} disabled={busy || !email} />
    </Screen>
  );
}

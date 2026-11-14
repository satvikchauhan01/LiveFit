import { Link, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { useAccountStore } from '@/features/account/accountStore';
import { errorMessage } from '@/features/account/apiClient';
import { spacing } from '@/theme/tokens';

export default function SignInScreen() {
  const signIn = useAccountStore((state) => state.signIn);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(undefined);
    try {
      await signIn({ email: email.trim(), password });
      router.replace('/account');
    } catch (failure) {
      setError(errorMessage(failure));
      setBusy(false);
    }
  };

  return (
    <Screen edges={['bottom']}>
      <AppText tone="muted">
        Sign in to back up your workouts and use LiveFit on more than one phone.
      </AppText>
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
      />
      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        error={error}
        onSubmitEditing={submit}
      />
      <Button
        label={busy ? 'Signing in…' : 'Sign in'}
        onPress={submit}
        disabled={busy || !email || !password}
      />
      <View style={styles.links}>
        <Link href="/account/forgot-password" style={styles.link}>
          <AppText tone="accent">Forgot your password?</AppText>
        </Link>
        <Link href="/account/sign-up" replace style={styles.link}>
          <AppText tone="accent">New here? Create an account</AppText>
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  links: {
    gap: spacing.lg,
    alignItems: 'center',
  },
  link: {
    paddingVertical: spacing.sm,
  },
});

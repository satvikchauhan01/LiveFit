import { Link, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { useAccountStore } from '@/features/account/accountStore';
import { errorMessage } from '@/features/account/apiClient';
import { useProfile } from '@/features/profile/profileStore';
import { spacing } from '@/theme/tokens';

const MIN_PASSWORD_LENGTH = 8;

export default function SignUpScreen() {
  const signUp = useAccountStore((state) => state.signUp);
  const profile = useProfile();
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  const tooShort = password.length > 0 && password.length < MIN_PASSWORD_LENGTH;

  const submit = async () => {
    setBusy(true);
    setError(undefined);
    try {
      await signUp({ email: email.trim(), password, displayName: displayName.trim() });
      router.replace('/account');
    } catch (failure) {
      setError(errorMessage(failure));
      setBusy(false);
    }
  };

  return (
    <Screen edges={['bottom']}>
      <AppText tone="muted">
        Your workouts on this phone are uploaded to your new account, so they’re backed up and
        appear on any phone you sign in on.
      </AppText>
      <TextField
        label="Name"
        value={displayName}
        onChangeText={setDisplayName}
        autoCapitalize="words"
        maxLength={40}
        placeholder="Optional"
      />
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
        autoComplete="new-password"
        textContentType="newPassword"
        hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
        error={tooShort ? `Use at least ${MIN_PASSWORD_LENGTH} characters.` : error}
      />
      <Button
        label={busy ? 'Creating account…' : 'Create account'}
        onPress={submit}
        disabled={busy || !email || password.length < MIN_PASSWORD_LENGTH}
      />
      <AppText variant="caption" tone="muted" style={styles.center}>
        By creating an account you agree to the LiveFit privacy policy. We’ll email you a link to
        confirm your address.
      </AppText>
      <Link href="/account/sign-in" replace style={styles.link}>
        <AppText tone="accent">Already have an account? Sign in</AppText>
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    textAlign: 'center',
  },
  link: {
    alignSelf: 'center',
    paddingVertical: spacing.sm,
  },
});

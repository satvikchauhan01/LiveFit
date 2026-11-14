import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ListRow } from '@/components/ListRow';
import { Screen } from '@/components/Screen';
import { useAccountStore } from '@/features/account/accountStore';
import { API_URL, errorMessage, serverConfigured } from '@/features/account/apiClient';
import { exportLocalData } from '@/features/account/localExport';
import { wipeLocalWorkouts } from '@/features/account/wipeLocalData';
import { useSyncStore } from '@/features/sync/syncStore';
import { formatTimeAgo } from '@/lib/format';
import { useNow } from '@/lib/useNow';
import { spacing } from '@/theme/tokens';

export default function AccountScreen() {
  const status = useAccountStore((state) => state.status);
  const user = useAccountStore((state) => state.user);
  const signOut = useAccountStore((state) => state.signOut);
  const refreshUser = useAccountStore((state) => state.refreshUser);
  const resendVerification = useAccountStore((state) => state.resendVerification);
  const sync = useSyncStore();
  const now = useNow(30_000);
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      Alert.alert('Something went wrong', errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const exportCard = (
    <Card>
      <ListRow
        icon="download-outline"
        title="Export my data"
        subtitle="Every workout, route and setting on this phone, as a JSON file"
        onPress={() => run(exportLocalData)}
      />
    </Card>
  );

  if (!serverConfigured) {
    return (
      <Screen edges={['bottom']}>
        <Card>
          <AppText variant="title">Accounts aren’t available in this build</AppText>
          <AppText tone="muted">
            This copy of LiveFit isn’t connected to a server, so everything stays on this phone.
          </AppText>
        </Card>
        {exportCard}
      </Screen>
    );
  }

  if (status !== 'signedIn') {
    return (
      <Screen edges={['bottom']}>
        <Card>
          <AppText variant="title">Back up and sync</AppText>
          <AppText tone="muted">
            With an account your workouts are backed up, and you can use LiveFit on more than one
            phone. Without one, everything stays on this phone, which is fine too.
          </AppText>
          <Button label="Create account" onPress={() => router.push('/account/sign-up')} />
          <Button
            label="Sign in"
            variant="secondary"
            onPress={() => router.push('/account/sign-in')}
          />
        </Card>
        {exportCard}
      </Screen>
    );
  }

  const syncText =
    sync.status === 'syncing'
      ? 'Syncing…'
      : sync.status === 'offline'
        ? 'Offline. Changes upload when you’re back online.'
        : sync.status === 'error'
          ? `Sync failed: ${sync.error ?? 'unknown error'}`
          : sync.lastSyncedAt
            ? `Synced ${formatTimeAgo(sync.lastSyncedAt, now)}`
            : 'Not synced yet';

  const confirmSignOut = () =>
    Alert.alert(
      'Sign out?',
      'Your workouts are safe on the server. Choose whether to keep a copy on this phone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove from this phone',
          style: 'destructive',
          onPress: () =>
            run(async () => {
              await sync.syncNow();
              await signOut();
              await wipeLocalWorkouts();
              router.back();
            }),
        },
        {
          text: 'Keep on this phone',
          onPress: () =>
            run(async () => {
              await sync.syncNow();
              await signOut();
              router.back();
            }),
        },
      ],
    );

  return (
    <Screen edges={['bottom']}>
      <Card>
        <AppText variant="title">{user?.displayName || 'Your account'}</AppText>
        <AppText tone="muted">{user?.email}</AppText>
        {user && !user.emailVerified && (
          <View style={styles.verify}>
            <AppText tone="warning">
              Please confirm your email address: we sent you a link when you signed up.
            </AppText>
            <View style={styles.row}>
              <Button
                label="Send again"
                variant="secondary"
                onPress={() =>
                  run(async () => {
                    await resendVerification();
                    Alert.alert('Sent', `Check ${user.email} for the link.`);
                  })
                }
                disabled={busy}
              />
              <Button
                label="I’ve confirmed"
                variant="ghost"
                onPress={() => run(refreshUser)}
                disabled={busy}
              />
            </View>
          </View>
        )}
      </Card>

      <Card>
        <AppText variant="label" tone="muted">
          Sync
        </AppText>
        <AppText tone={sync.status === 'error' ? 'danger' : 'default'}>{syncText}</AppText>
        <Button
          label="Sync now"
          variant="secondary"
          onPress={() => sync.syncNow()}
          disabled={sync.status === 'syncing'}
        />
      </Card>

      {exportCard}

      <Card>
        <ListRow
          icon="key-outline"
          title="Change password"
          onPress={() => router.push('/account/change-password')}
        />
        <ListRow icon="log-out-outline" title="Sign out" onPress={confirmSignOut} />
        <ListRow
          icon="trash-outline"
          title="Delete account"
          subtitle="Deletes your account and everything on the server"
          onPress={() => router.push('/account/delete')}
        />
      </Card>

      <AppText variant="caption" tone="muted" style={styles.center}>
        You can also delete your account in a browser at {API_URL}/account/delete
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  verify: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  center: {
    textAlign: 'center',
  },
});

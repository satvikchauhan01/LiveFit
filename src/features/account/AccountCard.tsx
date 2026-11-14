import { router } from 'expo-router';

import { Card } from '@/components/Card';
import { ListRow } from '@/components/ListRow';
import { useSyncStore } from '@/features/sync/syncStore';
import { formatTimeAgo } from '@/lib/format';

import { useAccountStore } from './accountStore';
import { serverConfigured } from './apiClient';

/** The Profile tab's entry into accounts: sign up, or see sync status. */
export function AccountCard() {
  const status = useAccountStore((state) => state.status);
  const user = useAccountStore((state) => state.user);
  const sync = useSyncStore();

  if (!serverConfigured) {
    return null;
  }

  if (status !== 'signedIn') {
    return (
      <Card>
        <ListRow
          icon="cloud-upload-outline"
          title="Back up and sync"
          subtitle="Create an account or sign in"
          onPress={() => router.push('/account')}
        />
      </Card>
    );
  }

  const subtitle =
    sync.status === 'syncing'
      ? 'Syncing…'
      : sync.status === 'offline'
        ? 'Offline: will sync later'
        : sync.status === 'error'
          ? 'Sync problem: tap for details'
          : sync.lastSyncedAt
            ? `Synced ${formatTimeAgo(sync.lastSyncedAt)}`
            : 'Signed in';

  return (
    <Card>
      <ListRow
        icon="person-circle-outline"
        title={user?.email ?? 'Account'}
        subtitle={subtitle}
        onPress={() => router.push('/account')}
      />
    </Card>
  );
}

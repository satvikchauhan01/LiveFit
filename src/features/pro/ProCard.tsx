import { router } from 'expo-router';

import { Card } from '@/components/Card';
import { ListRow } from '@/components/ListRow';
import { useAccountStore } from '@/features/account/accountStore';
import { serverConfigured } from '@/features/account/apiClient';

import { isProUser } from './proStatus';

/** Profile tab: the AI coach and LiveFit Pro. */
export function ProCard() {
  const user = useAccountStore((state) => state.user);
  if (!serverConfigured) return null;
  const pro = isProUser(user);

  return (
    <Card>
      <ListRow
        icon="sparkles-outline"
        title="AI coach"
        subtitle={pro ? 'Ask about your training' : 'Part of LiveFit Pro'}
        onPress={() => router.push('/coach')}
      />
      <ListRow
        icon="star-outline"
        title="LiveFit Pro"
        subtitle={pro ? 'Active' : 'Coach, public challenges and more'}
        onPress={() => router.push('/pro')}
      />
    </Card>
  );
}

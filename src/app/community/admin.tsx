import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { errorMessage } from '@/features/account/apiClient';
import { communityApi } from '@/features/community/communityApi';
import { RemoteState } from '@/features/community/RemoteState';
import { REPORT_REASONS } from '@/features/community/report';
import { useRemote } from '@/features/community/useRemote';
import { formatTimeAgo } from '@/lib/format';
import { spacing } from '@/theme/tokens';

type Action = 'dismiss' | 'hide' | 'suspend';

const ACTION_TEXT: Record<Action, string> = {
  dismiss: 'Nothing wrong: close the report.',
  hide: 'Hide the reported workout, comment or club.',
  suspend: 'Suspend the person who posted it. Their content disappears until it’s lifted.',
};

/** The moderators' queue of open reports. */
export default function AdminScreen() {
  const remote = useRemote(
    useCallback(async () => ({ ...(await communityApi.openReports()), loadedAt: Date.now() }), []),
  );
  const [busy, setBusy] = useState<string | null>(null);

  const resolve = (id: string, action: Action) =>
    Alert.alert('Are you sure?', ACTION_TEXT[action], [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        style: action === 'dismiss' ? 'default' : 'destructive',
        onPress: async () => {
          setBusy(id);
          try {
            await communityApi.resolveReport(id, action);
            remote.reload();
          } catch (error) {
            Alert.alert('Something went wrong', errorMessage(error));
          } finally {
            setBusy(null);
          }
        },
      },
    ]);

  const data = remote.data;

  return (
    <Screen edges={['bottom']}>
      <RemoteState remote={remote} />
      {data?.reports.length === 0 && (
        <EmptyState icon="shield-checkmark-outline" title="No open reports" message="All clear." />
      )}
      {data?.reports.map((report) => (
        <Card key={report.id}>
          <AppText variant="title">
            {REPORT_REASONS.find((option) => option.reason === report.reason)?.label ??
              report.reason}
          </AppText>
          <AppText tone="muted">
            {report.targetType} · {formatTimeAgo(report.createdAt, data.loadedAt)}
          </AppText>
          {report.details !== '' && <AppText>“{report.details}”</AppText>}
          {report.targetType === 'workout' && (
            <Button
              label="Open workout"
              variant="ghost"
              onPress={() =>
                router.push({
                  pathname: '/community/workout/[id]',
                  params: { id: report.targetId },
                })
              }
            />
          )}
          <View style={styles.buttons}>
            <View style={styles.flex}>
              <Button
                label="Dismiss"
                variant="secondary"
                disabled={busy === report.id}
                onPress={() => resolve(report.id, 'dismiss')}
              />
            </View>
            {report.targetType !== 'user' && (
              <View style={styles.flex}>
                <Button
                  label="Hide"
                  variant="secondary"
                  disabled={busy === report.id}
                  onPress={() => resolve(report.id, 'hide')}
                />
              </View>
            )}
            <View style={styles.flex}>
              <Button
                label="Suspend"
                variant="danger"
                disabled={busy === report.id}
                onPress={() => resolve(report.id, 'suspend')}
              />
            </View>
          </View>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  buttons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  flex: {
    flex: 1,
  },
});

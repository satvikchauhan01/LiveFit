import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Share, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { useAccountStore } from '@/features/account/accountStore';
import { errorMessage, serverConfigured } from '@/features/account/apiClient';
import { ACTIVITY_DISPLAY } from '@/features/workouts/activities';
import type { GpsActivityType } from '@/db/schema';
import { colors, spacing } from '@/theme/tokens';

import { endLiveShare, startLiveShare, useLiveShareStore } from './liveShare';

type Props = {
  workoutId: string;
  activity: GpsActivityType;
};

/** On the recording screen: share a live link to this workout, or stop sharing it. */
export function LiveShareButton({ workoutId, activity }: Props) {
  const signedIn = useAccountStore((state) => state.status === 'signedIn');
  const share = useLiveShareStore((state) => state.share);
  const loaded = useLiveShareStore((state) => state.loaded);
  const load = useLiveShareStore((state) => state.load);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loaded) load().catch(() => {});
  }, [loaded, load]);

  if (!serverConfigured) return null;

  const word = ACTIVITY_DISPLAY[activity].word;
  const send = (url: string) =>
    Share.share({ message: `Follow my ${word} live on LiveFit: ${url}` }).catch(() => {});

  const start = async () => {
    if (!signedIn) {
      Alert.alert('Sign in to share', 'Live links need a LiveFit account.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Sign in', onPress: () => router.push('/account') },
      ]);
      return;
    }
    setBusy(true);
    try {
      const created = await startLiveShare(workoutId, activity);
      await send(created.url);
    } catch (error) {
      Alert.alert('Couldn’t make a live link', errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const stop = () =>
    Alert.alert('Stop sharing?', 'The link stops showing where you are.', [
      { text: 'Keep sharing', style: 'cancel' },
      { text: 'Stop', style: 'destructive', onPress: () => endLiveShare().catch(() => {}) },
    ]);

  if (share && share.workoutId === workoutId) {
    return (
      <Card>
        <View style={styles.row}>
          <Icon name="radio-outline" color={colors.accent} />
          <AppText style={styles.flex}>Sharing your live location</AppText>
        </View>
        <AppText variant="caption" tone="muted">
          Anyone with the link can see where you are until you finish. It updates about every 20
          seconds.
        </AppText>
        <View style={styles.row}>
          <View style={styles.flex}>
            <Button label="Send link" variant="secondary" onPress={() => send(share.url)} />
          </View>
          <View style={styles.flex}>
            <Button label="Stop" variant="ghost" onPress={stop} />
          </View>
        </View>
      </Card>
    );
  }

  return (
    <Button
      label={busy ? 'Making a link…' : 'Share live location'}
      variant="secondary"
      onPress={start}
      disabled={busy}
    />
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  flex: {
    flex: 1,
  },
});

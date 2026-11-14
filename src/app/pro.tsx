import { router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Alert, Linking, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Icon, type IconName } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { useAccountStore } from '@/features/account/accountStore';
import { billingSupported, PRO_PRODUCT_ID, useBillingStore } from '@/features/pro/billing';
import { isProUser } from '@/features/pro/proStatus';
import { formatWorkoutDay } from '@/lib/format';
import { colors, spacing } from '@/theme/tokens';

const BENEFITS: { icon: IconName; title: string; text: string }[] = [
  {
    icon: 'sparkles-outline',
    title: 'AI coach',
    text: 'Ask about your training and get answers based on your own numbers. Log a gym session by typing it like a note.',
  },
  {
    icon: 'trophy-outline',
    title: 'Public challenges',
    text: 'Start challenges anyone on LiveFit can find and join.',
  },
  {
    icon: 'heart-outline',
    title: 'Support LiveFit',
    text: 'Recording, history, sharing and live location stay free for everyone.',
  },
];

const PACKAGE = 'com.livefit.app';

export default function ProScreen() {
  const user = useAccountStore((state) => state.user);
  const signedIn = useAccountStore((state) => state.status === 'signedIn');
  const { ready, offers, busy, error, loadOffers, buy, restore } = useBillingStore();
  const pro = isProUser(user);

  useEffect(() => {
    if (signedIn && billingSupported) loadOffers();
  }, [signedIn, loadOffers]);

  const restorePurchase = async () => {
    const restored = await restore();
    Alert.alert(
      restored ? 'Welcome back to Pro' : 'Nothing to restore',
      restored ? undefined : 'No active LiveFit Pro subscription was found on this Google account.',
    );
  };

  return (
    <Screen edges={['bottom']}>
      <AppText variant="headline">LiveFit Pro</AppText>
      {BENEFITS.map((benefit) => (
        <View key={benefit.title} style={styles.benefit}>
          <Icon name={benefit.icon} color={colors.accent} />
          <View style={styles.flex}>
            <AppText variant="title">{benefit.title}</AppText>
            <AppText tone="muted">{benefit.text}</AppText>
          </View>
        </View>
      ))}

      {!signedIn ? (
        <Button label="Sign in to get Pro" onPress={() => router.push('/account')} />
      ) : pro ? (
        <Card>
          <AppText variant="title">You have Pro</AppText>
          <AppText tone="muted">
            {user?.proUntil
              ? `Your current period runs until ${formatWorkoutDay(user.proUntil)}.`
              : 'Thanks for supporting LiveFit.'}
          </AppText>
          {billingSupported && (
            <Button
              label="Manage subscription"
              variant="secondary"
              onPress={() =>
                Linking.openURL(
                  `https://play.google.com/store/account/subscriptions?sku=${PRO_PRODUCT_ID}&package=${PACKAGE}`,
                )
              }
            />
          )}
        </Card>
      ) : !billingSupported ? (
        <Card>
          <AppText>Pro can be bought in the Android app for now.</AppText>
          <AppText tone="muted">
            If you subscribed on Android, sign in with the same account and Pro works here too.
          </AppText>
        </Card>
      ) : !ready ? (
        <ActivityIndicator color={colors.accent} />
      ) : offers.length === 0 ? (
        <AppText tone="muted">
          Pro isn’t available to buy right now. Check that Google Play is set up on this phone, then
          try again.
        </AppText>
      ) : (
        offers.map((offer) => (
          <Button
            key={offer.offerToken}
            label={`${offer.hasFreeTrial ? 'Start free trial, then ' : ''}${offer.displayPrice} ${offer.period}`.trim()}
            disabled={busy}
            onPress={() => buy(offer)}
          />
        ))
      )}

      {error && <AppText tone="danger">{error}</AppText>}

      {signedIn && billingSupported && !pro && (
        <Button
          label="Restore purchase"
          variant="ghost"
          disabled={busy}
          onPress={restorePurchase}
        />
      )}
      {billingSupported && (
        <AppText variant="caption" tone="muted">
          Billed through Google Play. Renews automatically until you cancel, which you can do any
          time in Google Play. Cancelling keeps Pro until the end of the period you paid for.
        </AppText>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  benefit: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  flex: {
    flex: 1,
  },
});

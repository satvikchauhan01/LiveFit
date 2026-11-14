import {
  fetchProducts,
  finishTransaction,
  getAvailablePurchases,
  initConnection,
  isUserCancelledError,
  type Purchase,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
} from 'expo-iap';
import { Platform } from 'react-native';
import { create } from 'zustand';

import type { ProStatus } from '@shared/api';

import { useAccountStore } from '@/features/account/accountStore';
import { api, errorMessage } from '@/features/account/apiClient';

// LiveFit Pro through Google Play. The phone buys; the server checks the
// purchase with Google and switches Pro on for the account (see server/src/billing).
// iOS needs App Store purchases and a server check of its own: not built yet.

/** The subscription's product id in Play Console (Monetize → Subscriptions). */
export const PRO_PRODUCT_ID = 'livefit_pro';

export const billingSupported = Platform.OS === 'android';

export type ProOffer = {
  offerToken: string;
  /** "monthly" / "yearly": the base plan id from Play Console. */
  basePlanId: string;
  displayPrice: string;
  period: string;
  hasFreeTrial: boolean;
};

type BillingState = {
  ready: boolean;
  offers: ProOffer[];
  busy: boolean;
  error: string | null;
  loadOffers: () => Promise<void>;
  buy: (offer: ProOffer) => Promise<void>;
  restore: () => Promise<boolean>;
};

function periodText(unit: string | undefined, count: number | null | undefined): string {
  const amount = count ?? 1;
  if (!unit || unit === 'unknown') return '';
  return amount === 1 ? `per ${unit}` : `every ${amount} ${unit}s`;
}

/** Sends the purchase to the server; once it's confirmed, Google is told the purchase is complete. */
async function confirm(purchase: Purchase): Promise<ProStatus | null> {
  if (purchase.productId !== PRO_PRODUCT_ID || purchase.purchaseState !== 'purchased') return null;
  if (!purchase.purchaseToken) return null;
  const status = await api<ProStatus>('/v1/billing/google/verify', {
    method: 'POST',
    body: { purchaseToken: purchase.purchaseToken, productId: purchase.productId },
  });
  await finishTransaction({ purchase, isConsumable: false });
  await useAccountStore.getState().refreshUser();
  return status;
}

let connected: Promise<boolean> | null = null;

/** Connects to Google Play once, and handles purchases as they complete. */
function connect(): Promise<boolean> {
  connected ??= (async () => {
    if (!billingSupported) return false;
    await initConnection();
    purchaseUpdatedListener((purchase) => {
      confirm(purchase)
        .then(() => useBillingStore.setState({ busy: false, error: null }))
        .catch((error: unknown) =>
          useBillingStore.setState({
            busy: false,
            error: `Your purchase went through, but LiveFit couldn’t confirm it yet: ${errorMessage(error)} Tap “Restore purchase” to try again.`,
          }),
        );
    });
    purchaseErrorListener((error) => {
      useBillingStore.setState({
        busy: false,
        error: isUserCancelledError(error) ? null : error.message,
      });
    });
    return true;
  })().catch((error: unknown) => {
    connected = null;
    throw error;
  });
  return connected;
}

export const useBillingStore = create<BillingState>()((set) => ({
  ready: false,
  offers: [],
  busy: false,
  error: null,

  loadOffers: async () => {
    try {
      if (!(await connect())) return;
      const products = await fetchProducts({ skus: [PRO_PRODUCT_ID], type: 'subs' });
      const offers: ProOffer[] = [];
      for (const product of products ?? []) {
        if (product.platform !== 'android' || product.type !== 'subs') continue;
        for (const offer of product.subscriptionOffers) {
          if (!offer.offerTokenAndroid) continue;
          offers.push({
            offerToken: offer.offerTokenAndroid,
            basePlanId: offer.basePlanIdAndroid ?? offer.id,
            displayPrice: offer.displayPrice,
            period: periodText(offer.period?.unit, offer.period?.value),
            hasFreeTrial: offer.paymentMode === 'free-trial',
          });
        }
      }
      set({ ready: true, offers, error: null });
    } catch (error) {
      set({ ready: true, error: errorMessage(error) });
    }
  },

  buy: async (offer) => {
    set({ busy: true, error: null });
    try {
      await connect();
      // Ties the purchase to this LiveFit account, so nobody else can claim it.
      const { obfuscatedAccountId } = await api<{ obfuscatedAccountId: string }>(
        '/v1/billing/account-id',
      );
      await requestPurchase({
        type: 'subs',
        request: {
          google: {
            skus: [PRO_PRODUCT_ID],
            subscriptionOffers: [{ sku: PRO_PRODUCT_ID, offerToken: offer.offerToken }],
            obfuscatedAccountId,
          },
        },
      });
      // The outcome arrives through the listeners above.
    } catch (error) {
      set({ busy: false, error: isUserCancelledError(error) ? null : errorMessage(error) });
    }
  },

  restore: async () => {
    set({ busy: true, error: null });
    try {
      await connect();
      const purchases = await getAvailablePurchases();
      let restored = false;
      for (const purchase of purchases) {
        const status = await confirm(purchase);
        if (status?.isPro) restored = true;
      }
      set({ busy: false });
      return restored;
    } catch (error) {
      set({ busy: false, error: errorMessage(error) });
      return false;
    }
  },
}));

import { importPKCS8, SignJWT } from 'jose';

import { env } from '../env';
import { HttpError } from '../lib/http';

// Talks to the Google Play Developer API with a service account, to check that
// a LiveFit Pro subscription is real and still active. Set up in Play Console:
// Setup → API access → a service account with "View financial data" and
// "Manage orders and subscriptions".

type ServiceAccount = { client_email: string; private_key: string; token_uri?: string };

const SCOPE = 'https://www.googleapis.com/auth/androidpublisher';
const API = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications';

let cached: { token: string; expiresAt: number } | null = null;

function serviceAccount(): ServiceAccount {
  if (!env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON) {
    throw new HttpError(503, 'billing_off', 'Purchases can’t be checked on this server yet.');
  }
  return JSON.parse(env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON) as ServiceAccount;
}

/** An OAuth access token for the Play API (cached until shortly before it expires). */
async function accessToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
  const account = serviceAccount();
  const tokenUri = account.token_uri ?? 'https://oauth2.googleapis.com/token';
  const key = await importPKCS8(account.private_key, 'RS256');
  const assertion = await new SignJWT({ scope: SCOPE })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(account.client_email)
    .setAudience(tokenUri)
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(key);
  const response = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!response.ok) {
    console.error('[billing] token request failed', response.status, await response.text());
    throw new HttpError(502, 'billing_unavailable', 'Couldn’t reach Google Play. Try again soon.');
  }
  const body = (await response.json()) as { access_token: string; expires_in: number };
  cached = { token: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
  return body.access_token;
}

async function play(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${API}/${encodeURIComponent(env.ANDROID_PACKAGE_NAME)}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
}

export type SubscriptionState =
  | 'SUBSCRIPTION_STATE_PENDING'
  | 'SUBSCRIPTION_STATE_ACTIVE'
  | 'SUBSCRIPTION_STATE_PAUSED'
  | 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD'
  | 'SUBSCRIPTION_STATE_ON_HOLD'
  | 'SUBSCRIPTION_STATE_CANCELED'
  | 'SUBSCRIPTION_STATE_EXPIRED'
  | 'SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED'
  | 'SUBSCRIPTION_STATE_UNSPECIFIED';

/** The parts of a Play SubscriptionPurchaseV2 that LiveFit uses. */
export type PlaySubscription = {
  subscriptionState: SubscriptionState;
  acknowledgementState?: 'ACKNOWLEDGEMENT_STATE_PENDING' | 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED';
  lineItems?: { productId: string; expiryTime?: string }[];
  externalAccountIdentifiers?: { obfuscatedExternalAccountId?: string };
  testPurchase?: object;
};

export async function getSubscription(purchaseToken: string): Promise<PlaySubscription> {
  const response = await play(`/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`);
  if (response.status === 404 || response.status === 410) {
    throw new HttpError(400, 'purchase_not_found', 'Google Play doesn’t know that purchase.');
  }
  if (!response.ok) {
    console.error('[billing] subscription lookup failed', response.status, await response.text());
    throw new HttpError(502, 'billing_unavailable', 'Couldn’t reach Google Play. Try again soon.');
  }
  return (await response.json()) as PlaySubscription;
}

/** Google refunds subscriptions that aren't acknowledged within three days. */
export async function acknowledge(productId: string, purchaseToken: string): Promise<void> {
  const response = await play(
    `/purchases/subscriptions/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`,
    { method: 'POST', body: '{}' },
  );
  if (!response.ok) {
    console.error('[billing] acknowledge failed', response.status, await response.text());
  }
}

/** States in which the person has paid for the current period. */
const ENTITLED: SubscriptionState[] = [
  'SUBSCRIPTION_STATE_ACTIVE',
  'SUBSCRIPTION_STATE_IN_GRACE_PERIOD',
  // Cancelled means "won't renew": it still runs until the period ends.
  'SUBSCRIPTION_STATE_CANCELED',
];

/** When Pro ends for this subscription, or null if it doesn't give Pro now. */
export function entitlementEnd(subscription: PlaySubscription): Date | null {
  if (!ENTITLED.includes(subscription.subscriptionState)) return null;
  const expiries = (subscription.lineItems ?? [])
    .map((item) => (item.expiryTime ? Date.parse(item.expiryTime) : NaN))
    .filter((time) => Number.isFinite(time));
  if (expiries.length === 0) return null;
  const end = new Date(Math.max(...expiries));
  return end.getTime() > Date.now() ? end : null;
}

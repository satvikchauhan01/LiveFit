import type { User } from '../db/schema';
import { HttpError } from '../lib/http';

/** LiveFit Pro is active until `proUntil`. */
export function isPro(proUntil: Date | null): boolean {
  return proUntil !== null && proUntil.getTime() > Date.now();
}

/** Stops a request for a Pro feature from someone without Pro (402, like a paywall). */
export function requirePro(user: User, feature: string): void {
  if (!isPro(user.proUntil)) {
    throw new HttpError(402, 'pro_required', `${feature} is a LiveFit Pro feature.`);
  }
}

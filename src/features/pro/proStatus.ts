import type { ApiUser } from '@shared/api';

/** LiveFit Pro is active for this account right now. */
export function isProUser(user: Pick<ApiUser, 'proUntil'> | null | undefined): boolean {
  return user?.proUntil != null && user.proUntil > Date.now();
}

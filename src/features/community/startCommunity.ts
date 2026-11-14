import { AppState } from 'react-native';

import { beforeSignOut, onSignedIn, useAccountStore } from '@/features/account/accountStore';
import { setDefaultVisibilityProvider } from '@/features/workouts/workoutRepository';

import { useCommunityStore } from './communityStore';
import { handlePushTaps, registerForPush, unregisterPush } from './push';

let started = false;
let lastRefresh = 0;

function warn(error: unknown) {
  console.warn('[community] refresh failed', error);
}

function hasCommunityAccount(): boolean {
  const { status, user } = useAccountStore.getState();
  return status === 'signedIn' && Boolean(user?.username);
}

/** Loads the settings and unread count, and registers this phone for push. */
function refresh(): void {
  if (!hasCommunityAccount()) return;
  lastRefresh = Date.now();
  const store = useCommunityStore.getState();
  Promise.all([store.loadSettings(), store.refreshUnread()]).catch(warn);
  registerForPush().catch(warn);
}

/** Called once the app has loaded. */
export function startCommunity(): void {
  if (started) return;
  started = true;

  setDefaultVisibilityProvider(
    () => useCommunityStore.getState().settings?.defaultVisibility ?? 'only_me',
  );
  handlePushTaps();
  beforeSignOut(unregisterPush);

  refresh();
  onSignedIn(refresh);
  useAccountStore.subscribe((state, previous) => {
    if (state.user?.username && state.user.username !== previous.user?.username) {
      refresh(); // just picked a username
    }
    if (state.status === 'signedOut' && previous.status === 'signedIn') {
      useCommunityStore.setState({ settings: null, unread: 0 });
    }
  });
  // Back in the app after a while: the badge may be out of date.
  AppState.addEventListener('change', (next) => {
    if (next === 'active' && Date.now() - lastRefresh > 60_000) refresh();
  });
}

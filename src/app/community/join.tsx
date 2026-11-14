import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { SegmentedControl } from '@/components/SegmentedControl';
import { TextField } from '@/components/TextField';
import { useAccountStore } from '@/features/account/accountStore';
import { errorMessage } from '@/features/account/apiClient';
import { communityApi } from '@/features/community/communityApi';

type JoinType = 'club' | 'challenge';

/**
 * Join a club or challenge with an invite code: typed in, or from an invite
 * link (livefit://community/join?type=club&code=ABCD2345).
 */
export default function JoinScreen() {
  const params = useLocalSearchParams<{ type?: string; code?: string }>();
  const signedIn = useAccountStore(
    (state) => state.status === 'signedIn' && Boolean(state.user?.username),
  );
  const [type, setType] = useState<JoinType>(params.type === 'challenge' ? 'challenge' : 'club');
  const [code, setCode] = useState(params.code ?? '');
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  const cleaned = code
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

  if (!signedIn) {
    return (
      <Screen>
        <EmptyState
          icon="people-outline"
          title="Sign in to join"
          message="You need a LiveFit account with a username to join clubs and challenges. Open the Community tab to set one up, then open the invite again."
          actionLabel="Go to Community"
          onAction={() => router.replace('/community')}
        />
      </Screen>
    );
  }

  const join = async () => {
    setJoining(true);
    setError(null);
    try {
      if (type === 'club') {
        const club = await communityApi.joinClub(cleaned);
        router.replace({ pathname: '/community/club/[id]', params: { id: club.id } });
      } else {
        const challenge = await communityApi.joinChallengeByCode(cleaned);
        router.replace({ pathname: '/community/challenge/[id]', params: { id: challenge.id } });
      }
    } catch (failure) {
      setError(errorMessage(failure));
      setJoining(false);
    }
  };

  return (
    <Screen edges={['bottom']}>
      <SegmentedControl
        options={[
          { value: 'club', label: 'Club' },
          { value: 'challenge', label: 'Challenge' },
        ]}
        value={type}
        onChange={setType}
        accessibilityLabel="What to join"
      />
      <TextField
        label="Invite code"
        value={code}
        onChangeText={setCode}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={16}
        autoFocus={!params.code}
      />
      {error && <AppText tone="danger">{error}</AppText>}
      <Button
        label={joining ? 'Joining…' : type === 'club' ? 'Join club' : 'Join challenge'}
        onPress={join}
        disabled={joining || cleaned.length < 4}
      />
    </Screen>
  );
}

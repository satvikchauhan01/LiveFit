import { useEffect, useState } from 'react';

import type { PublicUser } from '@shared/api';

import { AppText } from '@/components/AppText';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { errorMessage } from '@/features/account/apiClient';
import { communityApi } from '@/features/community/communityApi';
import { UserRow } from '@/features/community/UserRow';

/** Find people by username or name. */
export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PublicUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const trimmed = query.trim().replace(/^@/, '');

  // Search a moment after typing stops, not on every key press.
  useEffect(() => {
    if (trimmed.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      communityApi
        .search(trimmed)
        .then(({ users }) => {
          if (cancelled) return;
          setResults(users);
          setError(null);
        })
        .catch((failure: unknown) => {
          if (!cancelled) setError(errorMessage(failure));
        });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmed]);

  const shown = trimmed.length >= 2 ? results : null;

  return (
    <Screen edges={['bottom']}>
      <TextField
        label="Username or name"
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
        returnKeyType="search"
      />
      {error && <AppText tone="danger">{error}</AppText>}
      {shown?.length === 0 && <AppText tone="muted">No one found with that name.</AppText>}
      {shown?.map((user) => (
        <UserRow key={user.id} user={user} />
      ))}
      {trimmed.length < 2 && (
        <AppText variant="caption" tone="muted">
          Tip: friends can share their profile link or QR code from their own profile.
        </AppText>
      )}
    </Screen>
  );
}

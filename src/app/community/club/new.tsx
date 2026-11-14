import { router } from 'expo-router';
import { useState } from 'react';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { errorMessage } from '@/features/account/apiClient';
import { communityApi } from '@/features/community/communityApi';

export default function NewClubScreen() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const create = async () => {
    setSaving(true);
    setError(null);
    try {
      const club = await communityApi.createClub(name.trim(), description.trim());
      router.replace({ pathname: '/community/club/[id]', params: { id: club.id } });
    } catch (failure) {
      setError(errorMessage(failure));
      setSaving(false);
    }
  };

  return (
    <Screen edges={['bottom']}>
      <TextField label="Club name" value={name} onChangeText={setName} maxLength={60} autoFocus />
      <TextField
        label="What’s it about? (optional)"
        value={description}
        onChangeText={setDescription}
        maxLength={300}
        multiline
      />
      <AppText variant="caption" tone="muted">
        Clubs are invite-only: you’ll get a code and a link to send to people.
      </AppText>
      {error && <AppText tone="danger">{error}</AppText>}
      <Button
        label={saving ? 'Creating…' : 'Create club'}
        onPress={create}
        disabled={saving || name.trim().length < 2}
      />
    </Screen>
  );
}

import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import type { ReportReason, ReportTarget } from '@shared/api';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { errorMessage } from '@/features/account/apiClient';
import { communityApi } from '@/features/community/communityApi';
import { REPORT_REASONS } from '@/features/community/report';

const TARGET_WORD: Record<ReportTarget, string> = {
  user: 'this person',
  workout: 'this workout',
  comment: 'this comment',
  club: 'this club',
};

/** Tell the moderators about a person, workout, comment or club. */
export default function ReportScreen() {
  const { type, id } = useLocalSearchParams<{ type: ReportTarget; id: string }>();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!reason) return;
    setSending(true);
    try {
      await communityApi.report(type, id, reason, details.trim());
      router.back();
      Alert.alert('Thanks for telling us', 'A moderator will look at it soon.');
    } catch (error) {
      Alert.alert('Couldn’t send the report', errorMessage(error));
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen edges={['bottom']}>
      <AppText>What’s wrong with {TARGET_WORD[type] ?? 'this'}?</AppText>
      {REPORT_REASONS.map((option) => (
        <Chip
          key={option.reason}
          label={option.label}
          selected={reason === option.reason}
          onPress={() => setReason(option.reason)}
        />
      ))}
      <TextField
        label="Anything else? (optional)"
        value={details}
        onChangeText={setDetails}
        maxLength={1000}
        multiline
      />
      <AppText variant="caption" tone="muted">
        Reports are private: nobody is told who sent them. If you’re in danger, contact your local
        emergency services.
      </AppText>
      <Button
        label={sending ? 'Sending…' : 'Send report'}
        onPress={send}
        disabled={!reason || sending}
      />
    </Screen>
  );
}

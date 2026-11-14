import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import type { CoachStatus } from '@shared/api';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { useAccountStore } from '@/features/account/accountStore';
import { errorMessage } from '@/features/account/apiClient';
import { coachApi } from '@/features/coach/coachApi';
import { useCoachConsent } from '@/features/coach/consent';
import { buildTrainingSummary } from '@/features/coach/trainingSummary';
import { useRemote } from '@/features/community/useRemote';
import { isProUser } from '@/features/pro/proStatus';
import { useProfile } from '@/features/profile/profileStore';
import { colors, radius, spacing } from '@/theme/tokens';

const SUGGESTIONS = [
  'How did my last month go?',
  'Am I increasing my distance too fast?',
  'What should I do this week?',
  'How can I get stronger at squats?',
];

type Exchange = { question: string; answer: string | null; error: string | null };

export default function CoachScreen() {
  const profile = useProfile();
  const signedIn = useAccountStore((state) => state.status === 'signedIn');
  const pro = isProUser(useAccountStore((state) => state.user));
  const consent = useCoachConsent();
  const loadConsent = consent.load;
  const status = useRemote(
    useCallback(
      (): Promise<CoachStatus | null> => (signedIn ? coachApi.status() : Promise.resolve(null)),
      [signedIn],
    ),
  );
  const [question, setQuestion] = useState('');
  const [history, setHistory] = useState<Exchange[]>([]);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    loadConsent();
  }, [loadConsent]);

  const ask = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setAsking(true);
    setQuestion('');
    setHistory((items) => [{ question: trimmed, answer: null, error: null }, ...items]);
    const update = (change: Partial<Exchange>) =>
      setHistory((items) => [{ ...items[0], ...change }, ...items.slice(1)]);
    try {
      const summary = await buildTrainingSummary(profile);
      const { text: answer } = await coachApi.ask(trimmed, summary);
      update({ answer });
      status.reload();
    } catch (error) {
      update({ error: errorMessage(error) });
    } finally {
      setAsking(false);
    }
  };

  if (!signedIn) {
    return (
      <Screen>
        <EmptyState
          icon="sparkles-outline"
          title="Your AI coach"
          message="Sign in to ask questions about your training."
          actionLabel="Sign in"
          onAction={() => router.push('/account')}
        />
      </Screen>
    );
  }

  if (!pro) {
    return (
      <Screen>
        <EmptyState
          icon="sparkles-outline"
          title="The AI coach is part of Pro"
          message="Ask about your training and get answers based on your own numbers, or log a gym session by typing it like a note."
          actionLabel="See LiveFit Pro"
          onAction={() => router.push('/pro')}
        />
      </Screen>
    );
  }

  if (consent.given === null) {
    return (
      <Screen>
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  }

  if (!consent.given) {
    return (
      <Screen>
        <AppText variant="headline">Before you start</AppText>
        <Card>
          <AppText>
            To answer, LiveFit sends your question and a summary of your last 8 weeks (weekly
            totals, recent workouts with their distance, time and sets, your goals and plan) to
            Anthropic’s Claude AI.
          </AppText>
          <AppText tone="muted">
            Routes, places and times of day are never sent. Anthropic doesn’t use what LiveFit sends
            to train its models. Answers are general advice, not medical advice.
          </AppText>
        </Card>
        <Button label="I agree, start" onPress={() => consent.setGiven(true)} />
        <Button label="Not now" variant="ghost" onPress={() => router.back()} />
      </Screen>
    );
  }

  const unavailable = status.data && !status.data.available;

  return (
    <Screen edges={['bottom']}>
      {unavailable && (
        <Card>
          <AppText>The coach is resting right now.</AppText>
          <AppText tone="muted">Try again later, or after the 1st of the month.</AppText>
        </Card>
      )}
      <TextField
        label="Ask your coach"
        value={question}
        onChangeText={setQuestion}
        maxLength={1000}
        multiline
        placeholder="How should I train for a 10K?"
      />
      <Button
        label={asking ? 'Thinking…' : 'Ask'}
        onPress={() => ask(question)}
        disabled={asking || question.trim().length < 2 || Boolean(unavailable)}
      />
      {history.length === 0 && (
        <View style={styles.chips}>
          {SUGGESTIONS.map((suggestion) => (
            <Chip
              key={suggestion}
              label={suggestion}
              selected={false}
              onPress={() => ask(suggestion)}
            />
          ))}
        </View>
      )}
      {history.map((item, index) => (
        <View key={history.length - index} style={styles.exchange}>
          <View style={styles.question}>
            <AppText>{item.question}</AppText>
          </View>
          {item.answer ? (
            <AppText selectable>{item.answer}</AppText>
          ) : item.error ? (
            <AppText tone="danger">{item.error}</AppText>
          ) : (
            <ActivityIndicator color={colors.accent} style={styles.spinner} />
          )}
        </View>
      ))}
      {status.data && (
        <AppText variant="caption" tone="muted">
          {status.data.used} of {status.data.limit} questions used this month. The coach can make
          mistakes; check anything important.
        </AppText>
      )}
      <Button
        label="Stop sharing with the coach"
        variant="ghost"
        onPress={() => consent.setGiven(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  exchange: {
    gap: spacing.sm,
  },
  question: {
    alignSelf: 'flex-end',
    maxWidth: '85%',
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceRaised,
  },
  spinner: {
    alignSelf: 'flex-start',
  },
});

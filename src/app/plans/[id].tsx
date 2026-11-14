import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { SwitchRow } from '@/components/SwitchRow';
import { useProfileStore } from '@/features/profile/profileStore';
import { planById } from '@/features/progress/plans';
import { enrollInPlan, getActiveEnrollment } from '@/features/progress/progressRepository';
import { formatReminderDays } from '@/features/reminders/reminderSchedule';
import { syncReminders } from '@/features/reminders/reminders';
import { currentWeekKey } from '@/lib/dates';
import { spacing } from '@/theme/tokens';

export default function PlanDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const plan = planById(id);
  const update = useProfileStore((state) => state.update);
  const [remind, setRemind] = useState(true);
  const [busy, setBusy] = useState(false);

  if (!plan) {
    return (
      <Screen>
        <AppText>This plan doesn’t exist.</AppText>
      </Screen>
    );
  }

  const start = async () => {
    setBusy(true);
    try {
      await enrollInPlan(plan.id, currentWeekKey());
      if (remind) {
        const minutes = useProfileStore.getState().profile?.reminderMinutes ?? 18 * 60;
        await update({ reminderDays: formatReminderDays(plan.suggestedDays) });
        await syncReminders(plan.suggestedDays, minutes);
      }
      router.back();
    } catch (error) {
      setBusy(false);
      Alert.alert('Couldn’t start the plan', String(error));
    }
  };

  const confirmStart = async () => {
    if (await getActiveEnrollment()) {
      Alert.alert('Switch plans?', 'Your current plan will end. Your workouts stay.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Switch', onPress: start },
      ]);
    } else {
      await start();
    }
  };

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: plan.name }} />
      <AppText tone="muted">{plan.summary}</AppText>
      <Card>
        <SwitchRow
          title="Remind me on plan days"
          subtitle="Sets your workout reminders to the plan’s suggested days"
          value={remind}
          onValueChange={setRemind}
        />
        <Button
          label={busy ? 'Starting…' : 'Start this plan'}
          onPress={confirmStart}
          disabled={busy}
        />
      </Card>
      {plan.weeks.map((week, index) => (
        <Card key={index}>
          <AppText variant="label" tone="muted">
            Week {index + 1}
          </AppText>
          {week.map((session, sessionIndex) => (
            <View key={sessionIndex} style={styles.session}>
              <AppText>{session.title}</AppText>
              <AppText variant="caption" tone="muted">
                {session.description}
              </AppText>
            </View>
          ))}
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  session: {
    gap: 2,
    paddingVertical: spacing.xs,
  },
});

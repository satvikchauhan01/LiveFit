import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { ListRow } from '@/components/ListRow';
import { Screen } from '@/components/Screen';
import { planStatus } from '@/features/progress/planStatus';
import { PLANS } from '@/features/progress/plans';
import { endEnrollment, getActiveEnrollment } from '@/features/progress/progressRepository';
import { startPlanSession } from '@/features/progress/startPlanSession';
import { listWorkouts } from '@/features/workouts/workoutRepository';
import { useQueryOnFocus } from '@/lib/useQueryOnFocus';
import { colors, spacing } from '@/theme/tokens';

export default function PlansScreen() {
  const [version, setVersion] = useState(0);
  const active = useQueryOnFocus(
    useCallback(async () => {
      const enrollment = await getActiveEnrollment();
      if (!enrollment) return null;
      return { enrollment, status: planStatus(enrollment, await listWorkouts()) };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [version]),
  );

  const leave = (id: string) =>
    Alert.alert('Leave this plan?', 'Your workouts stay; the plan just stops tracking them.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave plan',
        style: 'destructive',
        onPress: async () => {
          await endEnrollment(id);
          setVersion((value) => value + 1);
        },
      },
    ]);

  const status = active?.status;

  return (
    <Screen edges={['bottom']}>
      {active && status && (
        <Card>
          <AppText variant="label" tone="accent">
            Your plan
          </AppText>
          <AppText variant="title">{status.plan.name}</AppText>
          {status.finished ? (
            <AppText>You finished the plan. Well done! Pick another below to keep going.</AppText>
          ) : (
            <>
              <AppText tone="muted">
                Week {status.weekIndex + 1} of {status.plan.weeks.length}
              </AppText>
              {status.sessions.map((session, index) => (
                <View key={index} style={styles.session}>
                  <Icon
                    name={status.done[index] ? 'checkmark-circle' : 'ellipse-outline'}
                    color={status.done[index] ? colors.accent : colors.textMuted}
                  />
                  <View style={styles.flex}>
                    <AppText>{session.title}</AppText>
                    <AppText variant="caption" tone="muted">
                      {session.description}
                    </AppText>
                  </View>
                </View>
              ))}
              {status.next && (
                <Button
                  label={`Start: ${status.next.title}`}
                  onPress={() => status.next && startPlanSession(status.next)}
                />
              )}
            </>
          )}
          <Button label="Leave plan" variant="ghost" onPress={() => leave(active.enrollment.id)} />
        </Card>
      )}

      <AppText variant="label" tone="muted">
        Plans
      </AppText>
      <Card>
        {PLANS.map((plan) => (
          <ListRow
            key={plan.id}
            icon="calendar-outline"
            title={plan.name}
            subtitle={`${plan.weeks.length} weeks · ${plan.summary}`}
            onPress={() => router.push({ pathname: '/plans/[id]', params: { id: plan.id } })}
          />
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  session: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  flex: {
    flex: 1,
    gap: 2,
  },
});

import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { ListRow } from '@/components/ListRow';
import { Screen } from '@/components/Screen';
import { deleteRoutine, listRoutines, routineItems } from '@/features/progress/progressRepository';
import { startFromRoutine } from '@/features/progress/startPlanSession';
import { useActiveSession } from '@/features/workouts/activeSession';
import { useQueryOnFocus } from '@/lib/useQueryOnFocus';

export default function RoutinesScreen() {
  const [version, setVersion] = useState(0);
  const active = useActiveSession();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const routines = useQueryOnFocus(useCallback(() => listRoutines(), [version]));

  const open = (id: string, name: string, items: ReturnType<typeof routineItems>) =>
    Alert.alert(name, `${items.length} exercises`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteRoutine(id);
          setVersion((value) => value + 1);
        },
      },
      ...(active ? [] : [{ text: 'Start workout', onPress: () => startFromRoutine(items) }]),
    ]);

  return (
    <Screen edges={['bottom']}>
      {routines && routines.length === 0 && (
        <EmptyState
          icon="list-outline"
          title="No routines yet"
          message="Open a finished strength workout and tap “Save as routine” to repeat it any time."
        />
      )}
      {routines && routines.length > 0 && (
        <Card>
          {routines.map((routine) => {
            const items = routineItems(routine);
            return (
              <ListRow
                key={routine.id}
                icon="barbell-outline"
                title={routine.name}
                subtitle={`${items.length} exercises`}
                onPress={() => open(routine.id, routine.name, items)}
              />
            );
          })}
        </Card>
      )}
      <AppText variant="caption" tone="muted">
        You can also start an empty strength workout and pick a routine there.
      </AppText>
    </Screen>
  );
}

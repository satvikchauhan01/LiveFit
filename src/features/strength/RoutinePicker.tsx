import { useState } from 'react';

import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { ListRow } from '@/components/ListRow';
import { listRoutines, routineItems } from '@/features/progress/progressRepository';
import { useQueryOnFocus } from '@/lib/useQueryOnFocus';

import { useStrengthStore } from './strengthStore';

/** On an empty strength workout: start from a saved routine in one tap. */
export function RoutinePicker() {
  const routines = useQueryOnFocus(listRoutines);
  const addRoutine = useStrengthStore((state) => state.addRoutine);
  const [adding, setAdding] = useState(false);

  if (!routines || routines.length === 0) return null;

  return (
    <Card>
      <AppText variant="label" tone="muted">
        Start from a routine
      </AppText>
      {routines.map((routine) => {
        const items = routineItems(routine);
        return (
          <ListRow
            key={routine.id}
            icon="list-outline"
            title={routine.name}
            subtitle={`${items.length} exercises`}
            onPress={async () => {
              if (adding) return;
              setAdding(true);
              await addRoutine(items);
              setAdding(false);
            }}
          />
        );
      })}
    </Card>
  );
}

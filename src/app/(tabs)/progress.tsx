import { useState } from 'react';

import { Screen } from '@/components/Screen';
import { SegmentedControl } from '@/components/SegmentedControl';
import { ProgressOverview } from '@/features/progress/ProgressOverview';
import { RecordsView } from '@/features/progress/RecordsView';
import { HistoryList } from '@/features/workouts/HistoryList';

type View = 'overview' | 'history' | 'records';

/** Progress: charts and totals, the full workout history, and personal records. */
export default function ProgressScreen() {
  const [view, setView] = useState<View>('overview');

  const switcher = (
    <SegmentedControl
      accessibilityLabel="Show"
      options={[
        { value: 'overview', label: 'Overview' },
        { value: 'history', label: 'History' },
        { value: 'records', label: 'Records' },
      ]}
      value={view}
      onChange={setView}
    />
  );

  // History is a long, virtualised list, so it brings its own scrolling.
  if (view === 'history') {
    return <HistoryList top={switcher} />;
  }

  return (
    <Screen>
      {switcher}
      {view === 'overview' ? <ProgressOverview /> : <RecordsView />}
    </Screen>
  );
}

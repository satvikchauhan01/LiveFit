import type { IconName } from '@/components/Icon';
import type { ActivityType } from '@/db/schema';

export const ACTIVITY_DISPLAY: Record<ActivityType, { label: string; icon: IconName }> = {
  run: { label: 'Run', icon: 'walk' },
  walk: { label: 'Walk', icon: 'footsteps' },
  strength: { label: 'Strength', icon: 'barbell' },
};

import type { Visibility } from '@shared/api';

import type { IconName } from '@/components/Icon';

export const VISIBILITY_OPTIONS: {
  value: Visibility;
  label: string;
  icon: IconName;
  description: string;
}[] = [
  {
    value: 'only_me',
    label: 'Only me',
    icon: 'lock-closed-outline',
    description: 'Nobody else sees it.',
  },
  {
    value: 'followers',
    label: 'Followers',
    icon: 'people-outline',
    description: 'People who follow you.',
  },
  {
    value: 'club',
    label: 'Followers + clubs',
    icon: 'people-circle-outline',
    description: 'Your followers and people in your clubs.',
  },
  {
    value: 'public',
    label: 'Everyone',
    icon: 'globe-outline',
    description: 'Anyone on LiveFit (only followers if your profile is private).',
  },
];

export function visibilityLabel(value: Visibility): string {
  return VISIBILITY_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

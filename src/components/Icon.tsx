import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';

import { colors } from '@/theme/tokens';

export type IconName = ComponentProps<typeof Ionicons>['name'];

type Props = {
  name: IconName;
  size?: number;
  /** Navigators hand icons a generic ColorValue; all LiveFit colours are plain strings. */
  color?: ColorValue;
};

/** One icon set for the whole app (Ionicons). Browse names at icons.expo.fyi. */
export function Icon({ name, size = 22, color = colors.text }: Props) {
  return (
    <Ionicons name={name} size={size} color={typeof color === 'string' ? color : colors.text} />
  );
}

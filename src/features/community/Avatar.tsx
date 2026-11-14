import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { colors, radius } from '@/theme/tokens';

type Props = {
  name: string;
  size?: number;
};

// Profile pictures would need image uploads and moderation; initials do the job.
const PALETTE = ['#2E6B4F', '#3B4F8C', '#7A4B2A', '#6B2E5E', '#2A6670', '#5C5A2A'];

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const first = words[0][0] ?? '';
  const last = words.length > 1 ? (words[words.length - 1][0] ?? '') : '';
  return (first + last).toUpperCase();
}

function colorFor(name: string): string {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

export function Avatar({ name, size = 40 }: Props) {
  return (
    <View
      style={[styles.circle, { width: size, height: size, backgroundColor: colorFor(name) }]}
      importantForAccessibility="no-hide-descendants"
    >
      <AppText style={[styles.text, { fontSize: size * 0.38 }]}>{initials(name)}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: colors.text,
    fontWeight: '700',
  },
});

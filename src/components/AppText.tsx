import { StyleSheet, Text, type TextProps } from 'react-native';

import { colors, fontSize, tabularNumbers } from '@/theme/tokens';

type Variant = 'display' | 'headline' | 'title' | 'body' | 'caption' | 'label';
type Tone = 'default' | 'muted' | 'accent' | 'danger' | 'warning';

type Props = TextProps & {
  variant?: Variant;
  tone?: Tone;
  /** Use fixed-width digits, for numbers that change while you look at them. */
  numeric?: boolean;
};

/** All text in the app goes through this, so type styles live in one place. */
export function AppText({
  variant = 'body',
  tone = 'default',
  numeric = false,
  style,
  ...rest
}: Props) {
  return (
    <Text style={[styles[variant], toneStyles[tone], numeric && tabularNumbers, style]} {...rest} />
  );
}

const styles = StyleSheet.create({
  display: {
    fontSize: fontSize.display,
    lineHeight: fontSize.display * 1.1,
    fontWeight: '800',
  },
  headline: {
    fontSize: fontSize.headline,
    lineHeight: fontSize.headline * 1.2,
    fontWeight: '800',
  },
  title: {
    fontSize: fontSize.title,
    lineHeight: fontSize.title * 1.3,
    fontWeight: '700',
  },
  body: {
    fontSize: fontSize.body,
    lineHeight: fontSize.body * 1.4,
  },
  caption: {
    fontSize: fontSize.caption,
    lineHeight: fontSize.caption * 1.4,
  },
  label: {
    fontSize: fontSize.caption,
    lineHeight: fontSize.caption * 1.4,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
});

const toneStyles = StyleSheet.create({
  default: { color: colors.text },
  muted: { color: colors.textMuted },
  accent: { color: colors.accent },
  danger: { color: colors.danger },
  warning: { color: colors.warning },
});

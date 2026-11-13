// Design tokens for the dark athletic look.
// Screens should only use these values, never raw hex codes or magic numbers,
// so the whole app can be re-themed (or given a light mode) from this one file.

export const colors = {
  background: '#0B0D0E',
  surface: '#16191B',
  surfaceRaised: '#1F2326',
  border: '#2A2F33',

  text: '#F4F6F5',
  textMuted: '#9AA3A0',
  textOnAccent: '#0B0D0E',

  accent: '#C6FF3D',
  accentPressed: '#A8DB2A',

  success: '#3DDC97',
  warning: '#FFB547',
  danger: '#FF5A5F',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

export const fontSize = {
  caption: 12,
  body: 16,
  title: 20,
  headline: 28,
  display: 56,
} as const;

// Tabular figures keep every digit the same width,
// so live numbers (timer, distance) don't wobble as they change.
export const tabularNumbers = { fontVariant: ['tabular-nums' as const] };

// Minimum comfortable touch target (Android guideline is 48dp).
export const minTouchTarget = 48;

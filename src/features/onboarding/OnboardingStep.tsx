import type { ReactNode } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { colors, radius, spacing } from '@/theme/tokens';

export const ONBOARDING_STEPS = 3;

type Props = {
  /** 1-based step number; omit for the welcome screen. */
  step?: number;
  title: string;
  description?: string;
  children?: ReactNode;
  /** Buttons pinned to the bottom of the screen. */
  footer: ReactNode;
};

/** Shared layout so every onboarding screen looks and behaves the same. */
export function OnboardingStep({ step, title, description, children, footer }: Props) {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      {/* Pushes the footer buttons up above the on-screen keyboard. */}
      <KeyboardAvoidingView style={styles.fill} behavior="padding">
        <ScrollView
          style={styles.fill}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {step !== undefined && (
            <View
              style={styles.progress}
              accessible
              accessibilityLabel={`Step ${step} of ${ONBOARDING_STEPS}`}
            >
              {Array.from({ length: ONBOARDING_STEPS }, (_, index) => (
                <View key={index} style={[styles.dot, index < step && styles.dotDone]} />
              ))}
            </View>
          )}
          <AppText variant="headline">{title}</AppText>
          {description && <AppText tone="muted">{description}</AppText>}
          {children}
        </ScrollView>
        <View style={styles.footer}>{footer}</View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  fill: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  progress: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  dot: {
    flex: 1,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
  },
  dotDone: {
    backgroundColor: colors.accent,
  },
  footer: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
});

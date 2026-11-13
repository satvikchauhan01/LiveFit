import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { type Edge, SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing } from '@/theme/tokens';

type Props = {
  children: ReactNode;
  /** Scrollable content (default) or a fixed layout. */
  scroll?: boolean;
  /**
   * Which screen edges need safe-area padding. Screens under a header or above
   * the tab bar don't need top/bottom — the navigator already handles those.
   */
  edges?: Edge[];
  contentStyle?: ViewStyle;
};

export function Screen({ children, scroll = true, edges = [], contentStyle }: Props) {
  return (
    <SafeAreaView style={styles.safeArea} edges={edges}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.content, contentStyle]}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, styles.fill, contentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.xl,
  },
  fill: {
    flex: 1,
  },
});

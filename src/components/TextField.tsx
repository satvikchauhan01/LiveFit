import { useState } from 'react';
import { StyleSheet, TextInput, type TextInputProps, View } from 'react-native';

import { colors, fontSize, minTouchTarget, radius, spacing } from '@/theme/tokens';

import { AppText } from './AppText';

type Props = Omit<TextInputProps, 'style'> & {
  label: string;
  /** Shown at the right end of the field, e.g. "kg". */
  suffix?: string;
  hint?: string;
  error?: string;
};

export function TextField({ label, suffix, hint, error, onFocus, onBlur, ...inputProps }: Props) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.container}>
      <AppText variant="label" tone="muted">
        {label}
      </AppText>
      <View
        style={[
          styles.field,
          inputProps.multiline && styles.fieldMultiline,
          focused && styles.fieldFocused,
          error ? styles.fieldError : null,
        ]}
      >
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.accent}
          style={[styles.input, inputProps.multiline && styles.inputMultiline]}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          {...inputProps}
        />
        {suffix && <AppText tone="muted">{suffix}</AppText>}
      </View>
      {error ? (
        <AppText variant="caption" tone="danger">
          {error}
        </AppText>
      ) : (
        hint && (
          <AppText variant="caption" tone="muted">
            {hint}
          </AppText>
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  field: {
    minHeight: minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fieldMultiline: {
    alignItems: 'flex-start',
  },
  fieldFocused: {
    borderColor: colors.accent,
  },
  fieldError: {
    borderColor: colors.danger,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: fontSize.body,
    paddingVertical: spacing.md,
  },
  inputMultiline: {
    minHeight: 96,
    // Android centres multi-line text vertically unless told otherwise.
    textAlignVertical: 'top',
  },
});

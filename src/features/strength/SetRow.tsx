import { memo, useState } from 'react';
import { Alert, Keyboard, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import type { LogType, StrengthSet } from '@/db/schema';
import type { WeightUnit } from '@/lib/units';
import { colors, fontSize, minTouchTarget, radius, spacing, tabularNumbers } from '@/theme/tokens';

import { inputFromSet, parseSetInput, type SetField, type SetInput } from './setInput';
import type { SetValues } from './strengthRepository';

type Props = {
  /** 1-based position shown to the user. */
  number: number;
  set: StrengthSet;
  logType: LogType;
  unit: WeightUnit;
  onSave: (setId: number, values: SetValues) => void;
  onComplete: (setId: number, values: SetValues) => void;
  onReopen: (setId: number) => void;
  onDelete: (setId: number) => void;
};

/** The input fields each kind of exercise needs, in order. */
export function fieldsFor(logType: LogType): SetField[] {
  if (logType === 'weight_reps') return ['load', 'reps'];
  if (logType === 'reps') return ['reps'];
  return ['time'];
}

/**
 * One set: number, inputs, and a tick button. The inputs keep their own text
 * while typing (so "6" on the way to "60" isn't rejected); values are parsed
 * and saved when a field loses focus or the set is ticked off.
 */
export const SetRow = memo(function SetRow({
  number,
  set,
  logType,
  unit,
  onSave,
  onComplete,
  onReopen,
  onDelete,
}: Props) {
  const [input, setInput] = useState<SetInput>(() => inputFromSet(set, unit));
  const [invalid, setInvalid] = useState<SetField[]>([]);
  const done = set.completedAt !== null;

  const change = (field: SetField, text: string) => {
    setInput((current) => ({ ...current, [field]: text }));
    setInvalid((current) => current.filter((item) => item !== field));
  };

  const saveIfValid = () => {
    const parsed = parseSetInput(input, logType, unit);
    if (
      parsed.ok &&
      (parsed.values.reps !== set.reps ||
        parsed.values.weightKg !== set.weightKg ||
        parsed.values.durationS !== set.durationS)
    ) {
      onSave(set.id, parsed.values);
    }
  };

  const toggle = () => {
    if (done) {
      onReopen(set.id);
      return;
    }
    const parsed = parseSetInput(input, logType, unit);
    if (!parsed.ok) {
      setInvalid(parsed.invalid);
      return;
    }
    Keyboard.dismiss();
    onComplete(set.id, parsed.values);
  };

  const confirmDelete = () =>
    Alert.alert(`Delete set ${number}?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete(set.id) },
    ]);

  const fieldLabel: Record<SetField, string> = { load: unit, reps: 'reps', time: 'seconds' };

  return (
    <View
      style={[styles.row, done && styles.rowDone]}
      accessibilityActions={[{ name: 'delete', label: 'Delete set' }]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'delete') confirmDelete();
      }}
    >
      <Pressable
        onLongPress={confirmDelete}
        accessibilityRole="button"
        accessibilityLabel={`Set ${number}`}
        accessibilityHint="Long press to delete this set"
        style={styles.number}
      >
        <AppText variant="title" tone="muted" numeric>
          {number}
        </AppText>
      </Pressable>

      {fieldsFor(logType).map((field) => (
        <TextInput
          key={field}
          value={input[field]}
          onChangeText={(text) => change(field, text)}
          onBlur={saveIfValid}
          keyboardType={field === 'load' ? 'decimal-pad' : 'number-pad'}
          // Tapping a prefilled field selects it, so typing replaces the old value.
          selectTextOnFocus
          maxLength={6}
          placeholder="–"
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.accent}
          accessibilityLabel={`Set ${number}, ${fieldLabel[field]}`}
          style={[
            styles.input,
            done && styles.inputDone,
            invalid.includes(field) && styles.inputInvalid,
          ]}
        />
      ))}

      <Pressable
        onPress={toggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done }}
        accessibilityLabel={done ? `Set ${number} done` : `Mark set ${number} done`}
        style={({ pressed }) => [styles.check, done && styles.checkDone, pressed && styles.pressed]}
      >
        <Icon name="checkmark" size={24} color={done ? colors.textOnAccent : colors.textMuted} />
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
  rowDone: {
    opacity: 0.85,
  },
  number: {
    width: 32,
    height: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    height: minTouchTarget,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    color: colors.text,
    fontSize: fontSize.title,
    fontWeight: '700',
    textAlign: 'center',
    ...tabularNumbers,
  },
  inputDone: {
    backgroundColor: colors.surface,
  },
  inputInvalid: {
    borderColor: colors.danger,
  },
  check: {
    width: minTouchTarget,
    height: minTouchTarget,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkDone: {
    backgroundColor: colors.accent,
  },
  pressed: {
    opacity: 0.7,
  },
});

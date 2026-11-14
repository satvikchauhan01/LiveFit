import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, SectionList, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { ListRow } from '@/components/ListRow';
import { TextField } from '@/components/TextField';
import type { Exercise } from '@/db/schema';
import { EQUIPMENT_LABEL } from '@/features/strength/builtInExercises';
import { searchExercises } from '@/features/strength/exerciseSearch';
import { listExercises } from '@/features/strength/strengthRepository';
import { useStrengthStore } from '@/features/strength/strengthStore';
import { useQueryOnFocus } from '@/lib/useQueryOnFocus';
import { colors, spacing } from '@/theme/tokens';

/** Search and pick an exercise to add to the strength workout. */
export default function PickExerciseScreen() {
  const addExercise = useStrengthStore((state) => state.addExercise);
  const all = useQueryOnFocus(listExercises);
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);

  const sections = useMemo(() => searchExercises(all ?? [], query), [all, query]);
  const typed = query.trim();
  const exactMatch = all?.some((exercise) => exercise.name.toLowerCase() === typed.toLowerCase());

  const pick = async (exercise: Exercise) => {
    if (adding) return;
    setAdding(true);
    try {
      await addExercise(exercise);
      router.back();
    } catch (error) {
      setAdding(false);
      Alert.alert('Couldn’t add exercise', String(error));
    }
  };

  const createCustom = () =>
    router.push({ pathname: '/exercises/new', params: typed ? { name: typed } : {} });

  return (
    <SectionList
      style={styles.list}
      contentContainerStyle={styles.content}
      sections={sections}
      keyExtractor={(exercise) => exercise.id}
      keyboardShouldPersistTaps="handled"
      stickySectionHeadersEnabled
      ListHeaderComponent={
        <View style={styles.header}>
          <TextField
            label="Search"
            value={query}
            onChangeText={setQuery}
            placeholder="e.g. squat, curl, plank"
            autoCorrect={false}
            returnKeyType="search"
          />
          {typed !== '' && !exactMatch && (
            <ListRow icon="add-circle-outline" title={`Create “${typed}”`} onPress={createCustom} />
          )}
        </View>
      }
      renderSectionHeader={({ section }) => (
        <AppText variant="label" tone="muted" style={styles.sectionHeader}>
          {section.title}
        </AppText>
      )}
      renderItem={({ item }) => (
        <ListRow
          title={item.name}
          subtitle={`${EQUIPMENT_LABEL[item.equipment]}${item.isCustom ? ' · Custom' : ''}`}
          onPress={() => pick(item)}
        />
      )}
      ListEmptyComponent={
        all ? <AppText tone="muted">No exercise matches “{typed}”.</AppText> : undefined
      }
      ListFooterComponent={
        <ListRow
          icon="create-outline"
          title="Create a custom exercise"
          subtitle="For anything that isn’t in the list"
          onPress={createCustom}
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  header: {
    gap: spacing.sm,
    paddingTop: spacing.lg,
  },
  sectionHeader: {
    backgroundColor: colors.background,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
  },
});

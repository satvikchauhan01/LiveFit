import { router } from 'expo-router';
import { type ReactNode, useCallback, useMemo, useState } from 'react';
import {
  ScrollView,
  SectionList,
  type SectionListRenderItem,
  StyleSheet,
  View,
} from 'react-native';

import { AppText } from '@/components/AppText';
import { Chip } from '@/components/Chip';
import { EmptyState } from '@/components/EmptyState';
import { useProfile } from '@/features/profile/profileStore';
import {
  ACTIVITY_FILTERS,
  type ActivityFilter,
  DATE_RANGES,
  type DateRange,
  toWorkoutFilter,
} from './filters';
import { useWorkoutList, useWorkoutTotals } from './useWorkouts';
import { groupByWeek, type WeekSection } from './weeks';
import type { WorkoutListItem } from './workoutRepository';
import { WorkoutRow } from './WorkoutRow';
import { currentWeekKey } from '@/lib/dates';
import { formatTotals } from '@/lib/format';
import { colors, radius, spacing } from '@/theme/tokens';

type Section = WeekSection<WorkoutListItem>;

/**
 * Every finished workout, grouped by week, with filters. `top` is shown above
 * the filters (the Progress tab puts its view switcher there).
 */
export function HistoryList({ top }: { top?: ReactNode }) {
  const { distanceUnit: unit, weightUnit } = useProfile();
  const [activity, setActivity] = useState<ActivityFilter>('all');
  const [range, setRange] = useState<DateRange>('all');

  // useMemo keeps the same filter object between renders, so the queries only
  // run again when a filter actually changes.
  const filter = useMemo(() => toWorkoutFilter(activity, range), [activity, range]);
  const workouts = useWorkoutList(filter);
  const totals = useWorkoutTotals(filter);

  const thisWeek = currentWeekKey();
  const sections = useMemo(
    () => (workouts ? groupByWeek(workouts, thisWeek) : []),
    [workouts, thisWeek],
  );
  const filtered = activity !== 'all' || range !== 'all';

  const renderItem: SectionListRenderItem<WorkoutListItem, Section> = useCallback(
    ({ item, index, section }) => (
      <View
        style={[
          styles.rowBox,
          index === 0 && styles.firstRow,
          index === section.data.length - 1 && styles.lastRow,
        ]}
      >
        <WorkoutRow workout={item} distanceUnit={unit} weightUnit={weightUnit} />
      </View>
    ),
    [unit, weightUnit],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: Section }) => (
      <View style={styles.sectionHeader}>
        <AppText variant="label">{section.title}</AppText>
        <AppText variant="caption" tone="muted">
          {formatTotals(section.totals, unit)}
        </AppText>
      </View>
    ),
    [unit],
  );

  const header = (
    <View style={styles.filters}>
      {top}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        {ACTIVITY_FILTERS.map((option) => (
          <Chip
            key={option.value}
            label={option.label}
            selected={activity === option.value}
            onPress={() => setActivity(option.value)}
          />
        ))}
      </ScrollView>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        {DATE_RANGES.map((option) => (
          <Chip
            key={option.value}
            label={option.label}
            selected={range === option.value}
            onPress={() => setRange(option.value)}
          />
        ))}
      </ScrollView>
      {totals && totals.count > 0 && (
        <AppText tone="muted">
          {filtered ? 'Matching: ' : 'All time: '}
          {formatTotals(totals, unit)}
        </AppText>
      )}
    </View>
  );

  const empty =
    workouts === null ? undefined : filtered ? (
      <EmptyState
        icon="filter-outline"
        title="No matching workouts"
        message="Nothing fits these filters yet."
        actionLabel="Clear filters"
        onAction={() => {
          setActivity('all');
          setRange('all');
        }}
      />
    ) : (
      <EmptyState
        icon="time-outline"
        title="No workouts yet"
        message="Your runs, walks and gym sessions will appear here, newest first."
        actionLabel="Start a workout"
        onAction={() => router.push('/record')}
      />
    );

  return (
    // SectionList only renders the rows near the screen and recycles the rest,
    // so it stays fast with hundreds of workouts (a ScrollView renders them all).
    <SectionList
      style={styles.list}
      contentContainerStyle={styles.content}
      sections={sections}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      renderSectionHeader={renderSectionHeader}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      stickySectionHeadersEnabled
      initialNumToRender={12}
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
  filters: {
    gap: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  chips: {
    gap: spacing.sm,
  },
  sectionHeader: {
    // Sticky headers sit on top of the rows, so they need a solid background.
    backgroundColor: colors.background,
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
    gap: 2,
  },
  rowBox: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
  },
  firstRow: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  lastRow: {
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
  },
});

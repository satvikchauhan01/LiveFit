import { addDays, type DateKey, formatWeekLabel, weekKeyOf } from '@/lib/dates';

import type { Totals, WorkoutListItem } from './workoutRepository';

type WeekItem = Pick<WorkoutListItem, 'startedAt' | 'timezone' | 'distanceM' | 'movingS'>;

export type WeekSection<T> = {
  key: DateKey;
  title: string;
  totals: Totals;
  /** Named `data` because that's what React Native's SectionList expects. */
  data: T[];
};

/** Workouts are counted in the week (and time zone) they were recorded in. */
export function weekOf(item: Pick<WorkoutListItem, 'startedAt' | 'timezone'>): DateKey {
  return weekKeyOf(item.startedAt, item.timezone);
}

export function addUp(items: WeekItem[]): Totals {
  return items.reduce<Totals>(
    (totals, item) => ({
      count: totals.count + 1,
      distanceM: totals.distanceM + (item.distanceM ?? 0),
      movingS: totals.movingS + (item.movingS ?? 0),
    }),
    { count: 0, distanceM: 0, movingS: 0 },
  );
}

/** Splits a newest-first list into one section per week, keeping the order. */
export function groupByWeek<T extends WeekItem>(
  items: T[],
  currentWeekKey: DateKey,
): WeekSection<T>[] {
  const sections: WeekSection<T>[] = [];
  const byKey = new Map<DateKey, WeekSection<T>>();
  for (const item of items) {
    const key = weekOf(item);
    let section = byKey.get(key);
    if (!section) {
      section = { key, title: formatWeekLabel(key, currentWeekKey), totals: addUp([]), data: [] };
      byKey.set(key, section);
      sections.push(section);
    }
    section.data.push(item);
  }
  for (const section of sections) {
    section.totals = addUp(section.data);
  }
  return sections;
}

export function countByWeek(items: Pick<WorkoutListItem, 'startedAt' | 'timezone'>[]) {
  const counts = new Map<DateKey, number>();
  for (const item of items) {
    const key = weekOf(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/**
 * Consecutive weeks, up to now, with at least `goal` workouts. A weekly streak
 * means rest days never break it. The current week only joins the streak once
 * its goal is met; until then the streak still counts up to last week.
 */
export function weeklyStreak(
  counts: Map<DateKey, number>,
  currentWeekKey: DateKey,
  goal: number,
): number {
  const metGoal = (key: DateKey) => (counts.get(key) ?? 0) >= goal;
  let week = metGoal(currentWeekKey) ? currentWeekKey : addDays(currentWeekKey, -7);
  let streak = 0;
  while (metGoal(week)) {
    streak += 1;
    week = addDays(week, -7);
  }
  return streak;
}

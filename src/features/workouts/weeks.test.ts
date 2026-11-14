import { describe, expect, it } from '@jest/globals';

import { countByWeek, groupByWeek, weeklyStreak } from './weeks';
import type { WorkoutListItem } from './workoutRepository';

let nextId = 0;

/** A finished 5 km run at the given UTC time. */
function workout(isoUtc: string, timezone = 'UTC'): WorkoutListItem {
  nextId += 1;
  return {
    id: `w${nextId}`,
    type: 'run',
    title: '',
    startedAt: Date.parse(isoUtc),
    timezone,
    distanceM: 5000,
    movingS: 1500,
    volumeKg: null,
    elevationGainM: null,
    caloriesEst: null,
    extras: '{}',
  };
}

describe('groupByWeek', () => {
  it('makes one section per week, newest first, with totals', () => {
    const list = [
      workout('2026-11-12T07:00:00Z'), // Thu, this week
      workout('2026-11-09T07:00:00Z'), // Mon, this week
      workout('2026-11-08T07:00:00Z'), // Sun, last week
      workout('2026-10-20T07:00:00Z'),
    ];

    const sections = groupByWeek(list, '2026-11-09');

    expect(sections.map((s) => s.title)).toEqual(['This week', 'Last week', '19–25 Oct']);
    expect(sections[0].data).toHaveLength(2);
    expect(sections[0].totals).toEqual({ count: 2, distanceM: 10_000, movingS: 3000 });
    expect(sections[1].totals.count).toBe(1);
  });

  it('puts a workout in the week of the place it was recorded', () => {
    // Sunday 23:30 UTC is already Monday in India.
    const late = workout('2026-11-15T23:30:00Z', 'Asia/Kolkata');

    expect(groupByWeek([late], '2026-11-16')[0].title).toBe('This week');
    expect(countByWeek([late]).get('2026-11-16')).toBe(1);
  });
});

describe('weeklyStreak', () => {
  const thisWeek = '2026-11-09';
  const counts = (entries: [string, number][]) => new Map(entries);

  it('counts the weeks in a row that met the goal, including this one', () => {
    const streak = weeklyStreak(
      counts([
        ['2026-11-09', 3],
        ['2026-11-02', 2],
        ['2026-10-26', 4],
        ['2026-10-12', 5], // 19 Oct is missing, so the streak stops before this
      ]),
      thisWeek,
      2,
    );
    expect(streak).toBe(3);
  });

  it('doesn’t break the streak while this week is still in progress', () => {
    const streak = weeklyStreak(
      counts([
        ['2026-11-09', 1], // not there yet
        ['2026-11-02', 2],
        ['2026-10-26', 2],
      ]),
      thisWeek,
      2,
    );
    expect(streak).toBe(2);
  });

  it('is zero when last week missed the goal and this week hasn’t met it', () => {
    expect(weeklyStreak(counts([['2026-11-02', 1]]), thisWeek, 2)).toBe(0);
    expect(weeklyStreak(new Map(), thisWeek, 1)).toBe(0);
  });
});

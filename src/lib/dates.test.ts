import { describe, expect, it } from '@jest/globals';

import { addDays, formatWeekLabel, localDateTime, startOfWeek, weekKeyOf } from './dates';
import { formatWorkoutDate } from './format';

// Sunday 15 November 2026, 23:30 in London (UTC at that time of year).
const SUNDAY_NIGHT_UTC = Date.UTC(2026, 10, 15, 23, 30);

describe('localDateTime', () => {
  it('reads the date and time in the given time zone', () => {
    expect(localDateTime(SUNDAY_NIGHT_UTC, 'UTC')).toEqual({
      year: 2026,
      month: 11,
      day: 15,
      hour: 23,
      minute: 30,
      weekday: 6, // Sunday
    });
    // India is UTC+5:30, so it's already Monday morning there.
    expect(localDateTime(SUNDAY_NIGHT_UTC, 'Asia/Kolkata')).toMatchObject({
      day: 16,
      hour: 5,
      minute: 0,
      weekday: 0,
    });
    // New York is UTC−5 in November (daylight saving ended on 1 November).
    expect(localDateTime(SUNDAY_NIGHT_UTC, 'America/New_York')).toMatchObject({
      day: 15,
      hour: 18,
      minute: 30,
    });
  });

  it('falls back to the phone’s zone for an unknown time zone', () => {
    const date = new Date(SUNDAY_NIGHT_UTC);
    expect(localDateTime(SUNDAY_NIGHT_UTC, 'Not/AZone')).toMatchObject({
      day: date.getDate(),
      hour: date.getHours(),
    });
  });
});

describe('weekKeyOf', () => {
  it('gives the Monday of the week where the workout happened', () => {
    expect(weekKeyOf(SUNDAY_NIGHT_UTC, 'UTC')).toBe('2026-11-09');
    expect(weekKeyOf(SUNDAY_NIGHT_UTC, 'Asia/Kolkata')).toBe('2026-11-16');
  });
});

describe('addDays', () => {
  it('crosses months, years and leap days', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDays('2024-03-01', -1)).toBe('2024-02-29');
    expect(addDays('2026-11-09', -7)).toBe('2026-11-02');
  });

  it('is not thrown off by daylight saving', () => {
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29');
    expect(addDays('2026-10-24', 7)).toBe('2026-10-31');
  });
});

describe('formatWeekLabel', () => {
  const current = '2026-11-09';

  it('names this week and last week', () => {
    expect(formatWeekLabel('2026-11-09', current)).toBe('This week');
    expect(formatWeekLabel('2026-11-02', current)).toBe('Last week');
  });

  it('shows the date range of older weeks', () => {
    expect(formatWeekLabel('2026-10-12', current)).toBe('12–18 Oct');
    expect(formatWeekLabel('2026-10-26', current)).toBe('26 Oct – 1 Nov');
  });

  it('adds the year for weeks outside the current year', () => {
    expect(formatWeekLabel('2025-06-02', current)).toBe('2–8 Jun 2025');
    expect(formatWeekLabel('2025-12-29', current)).toBe('29 Dec 2025 – 4 Jan 2026');
  });
});

describe('formatWorkoutDate', () => {
  it('shows the time on the clock where the workout happened', () => {
    const now = Date.UTC(2026, 10, 20);
    expect(formatWorkoutDate(SUNDAY_NIGHT_UTC, 'UTC', now)).toBe('Sun 15 Nov · 23:30');
    expect(formatWorkoutDate(SUNDAY_NIGHT_UTC, 'Asia/Kolkata', now)).toBe('Mon 16 Nov · 05:00');
  });

  it('adds the year when it isn’t this year', () => {
    const nextYear = Date.UTC(2027, 1, 1);
    expect(formatWorkoutDate(SUNDAY_NIGHT_UTC, 'UTC', nextYear)).toBe('Sun 15 Nov 2026 · 23:30');
  });
});

describe('startOfWeek', () => {
  // Dates are built in local time, so these pass in any time zone.
  const monday = new Date(2026, 10, 9);

  it('goes back to Monday midnight', () => {
    expect(startOfWeek(new Date(2026, 10, 13, 15, 30))).toEqual(monday); // Friday afternoon
    expect(startOfWeek(new Date(2026, 10, 15, 23, 59))).toEqual(monday); // Sunday night
  });

  it('keeps Monday itself', () => {
    expect(startOfWeek(new Date(2026, 10, 9, 0, 0))).toEqual(monday);
  });
});

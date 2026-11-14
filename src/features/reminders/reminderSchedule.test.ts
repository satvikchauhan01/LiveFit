import { describe, expect, it } from '@jest/globals';

import {
  describeReminders,
  formatClock,
  formatReminderDays,
  parseReminderDays,
  toggleDay,
  toNotificationWeekday,
} from './reminderSchedule';

describe('reminder days', () => {
  it('reads the stored list, ignoring anything that isn’t a weekday', () => {
    expect(parseReminderDays('1,3,5')).toEqual([1, 3, 5]);
    expect(parseReminderDays('5, 1,1,9,x')).toEqual([1, 5]);
    expect(parseReminderDays('')).toEqual([]);
  });

  it('writes a sorted list without repeats', () => {
    expect(formatReminderDays([5, 1, 3, 1])).toBe('1,3,5');
    expect(formatReminderDays([])).toBe('');
  });

  it('toggles a day on and off', () => {
    expect(toggleDay([1, 5], 3)).toEqual([1, 3, 5]);
    expect(toggleDay([1, 3, 5], 3)).toEqual([1, 5]);
  });

  it('converts ISO weekdays to the notification library’s numbering', () => {
    // ISO: Monday = 1 … Sunday = 7. expo-notifications: Sunday = 1 … Saturday = 7.
    expect(toNotificationWeekday(1)).toBe(2); // Monday
    expect(toNotificationWeekday(6)).toBe(7); // Saturday
    expect(toNotificationWeekday(7)).toBe(1); // Sunday
  });
});

describe('describing reminders', () => {
  it('formats the time', () => {
    expect(formatClock(18 * 60)).toBe('18:00');
    expect(formatClock(7 * 60 + 5)).toBe('07:05');
  });

  it('lists the days in plain words', () => {
    expect(describeReminders([1, 3, 5], 18 * 60)).toBe('Mon, Wed and Fri at 18:00');
    expect(describeReminders([6], 9 * 60)).toBe('Sat at 09:00');
    expect(describeReminders([1, 2, 3, 4, 5, 6, 7], 7 * 60 + 30)).toBe('Every day at 07:30');
  });
});

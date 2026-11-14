// Pure helpers for workout reminders (no notifications here, so they're easy to test).

/** ISO weekdays: 1 = Monday … 7 = Sunday. */
export const WEEKDAYS = [
  { day: 1, short: 'Mo', name: 'Monday' },
  { day: 2, short: 'Tu', name: 'Tuesday' },
  { day: 3, short: 'We', name: 'Wednesday' },
  { day: 4, short: 'Th', name: 'Thursday' },
  { day: 5, short: 'Fr', name: 'Friday' },
  { day: 6, short: 'Sa', name: 'Saturday' },
  { day: 7, short: 'Su', name: 'Sunday' },
];

/** "1,3,5" → [1, 3, 5]. Ignores anything that isn't a weekday; sorted, no repeats. */
export function parseReminderDays(text: string): number[] {
  const days = text
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((day) => Number.isInteger(day) && day >= 1 && day <= 7);
  return [...new Set(days)].sort((a, b) => a - b);
}

export function formatReminderDays(days: number[]): string {
  return [...new Set(days)].sort((a, b) => a - b).join(',');
}

/** Adds the day if it's missing, removes it if it's there. */
export function toggleDay(days: number[], day: number): number[] {
  return days.includes(day) ? days.filter((item) => item !== day) : [...days, day].sort();
}

/**
 * expo-notifications counts weekdays like the US calendar (1 = Sunday … 7 = Saturday);
 * LiveFit uses ISO weeks (1 = Monday … 7 = Sunday).
 */
export function toNotificationWeekday(isoDay: number): number {
  return (isoDay % 7) + 1;
}

/** 1080 → "18:00". */
export function formatClock(minutesAfterMidnight: number): string {
  const hours = Math.floor(minutesAfterMidnight / 60);
  const minutes = minutesAfterMidnight % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

/** "Mon, Wed and Fri at 18:00", "Every day at 07:30". */
export function describeReminders(days: number[], minutesAfterMidnight: number): string {
  const time = formatClock(minutesAfterMidnight);
  if (days.length === 7) return `Every day at ${time}`;
  const names = WEEKDAYS.filter((weekday) => days.includes(weekday.day)).map((weekday) =>
    weekday.name.slice(0, 3),
  );
  const list =
    names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0];
  return `${list} at ${time}`;
}

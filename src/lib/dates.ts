// Dates and time zones.
//
// A timestamp (Unix ms) is one instant everywhere on Earth. "Which day was it?"
// depends on where you were: 23:30 on Sunday in New York is already Monday in
// London. Workouts store the time zone they were recorded in, so they're always
// shown with the date and time on the clock where they happened.
//
// Calendar days are handled as "YYYY-MM-DD" keys (DateKey). Adding days to a key
// is plain calendar maths, done in UTC, so daylight-saving changes can't shift it.

export type DateKey = string;

export type LocalDateTime = {
  year: number;
  /** 1 = January. */
  month: number;
  day: number;
  hour: number;
  minute: number;
  /** 0 = Monday … 6 = Sunday. */
  weekday: number;
};

export const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
export const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** The phone's current time zone, e.g. "Asia/Kolkata". */
export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
  } catch {
    return 'UTC';
  }
}

/** 0 = Monday … 6 = Sunday, for a calendar date. */
export function weekdayOf(year: number, month: number, day: number): number {
  return (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7;
}

// Creating a formatter is slow, so keep one per time zone.
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hourCycle: 'h23',
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

/**
 * The calendar date and clock time of an instant in a given time zone.
 * Without a zone (or with one this phone doesn't know) it uses the phone's own zone.
 */
export function localDateTime(ms: number, timeZone?: string | null): LocalDateTime {
  if (timeZone) {
    try {
      const parts = formatterFor(timeZone).formatToParts(new Date(ms));
      const read = (type: Intl.DateTimeFormatPartTypes) =>
        Number(parts.find((part) => part.type === type)?.value);
      const year = read('year');
      const month = read('month');
      const day = read('day');
      // Some engines write midnight as "24".
      const hour = read('hour') % 24;
      const minute = read('minute');
      if ([year, month, day, hour, minute].every(Number.isFinite)) {
        return { year, month, day, hour, minute, weekday: weekdayOf(year, month, day) };
      }
    } catch {
      // Unknown time zone: fall through to the phone's zone.
    }
  }
  const date = new Date(ms);
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hour: date.getHours(),
    minute: date.getMinutes(),
    weekday: (date.getDay() + 6) % 7,
  };
}

const pad2 = (value: number) => value.toString().padStart(2, '0');

export function toDateKey(year: number, month: number, day: number): DateKey {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function parseDateKey(key: DateKey): { year: number; month: number; day: number } {
  const [year, month, day] = key.split('-').map(Number);
  return { year, month, day };
}

export function addDays(key: DateKey, days: number): DateKey {
  const { year, month, day } = parseDateKey(key);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return toDateKey(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

/** The Monday that starts the week containing this instant, in the given time zone. */
export function weekKeyOf(ms: number, timeZone?: string | null): DateKey {
  const local = localDateTime(ms, timeZone);
  return addDays(toDateKey(local.year, local.month, local.day), -local.weekday);
}

/** The Monday of this week, on the phone's clock. */
export function currentWeekKey(): DateKey {
  return weekKeyOf(Date.now());
}

/** Monday 00:00, local time, of the week that contains `date`. */
export function startOfWeek(date: Date): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const daysSinceMonday = (start.getDay() + 6) % 7; // getDay(): Sunday = 0
  start.setDate(start.getDate() - daysSinceMonday);
  return start;
}

/** "This week", "Last week", "9–15 Nov", "27 Oct – 2 Nov", "29 Dec 2025 – 4 Jan 2026". */
export function formatWeekLabel(key: DateKey, currentWeekKey: DateKey): string {
  if (key === currentWeekKey) return 'This week';
  if (key === addDays(currentWeekKey, -7)) return 'Last week';

  const start = parseDateKey(key);
  const end = parseDateKey(addDays(key, 6));
  const currentYear = parseDateKey(currentWeekKey).year;
  const withYear = start.year !== currentYear || end.year !== currentYear;
  const endText = `${end.day} ${MONTH_SHORT[end.month - 1]}${withYear ? ` ${end.year}` : ''}`;

  if (start.month === end.month) {
    return `${start.day}–${endText}`;
  }
  const startYear = withYear && start.year !== end.year ? ` ${start.year}` : '';
  return `${start.day} ${MONTH_SHORT[start.month - 1]}${startYear} – ${endText}`;
}

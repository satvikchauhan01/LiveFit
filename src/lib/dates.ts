/** Monday 00:00, local time, of the week that contains `date`. */
export function startOfWeek(date: Date): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const daysSinceMonday = (start.getDay() + 6) % 7; // getDay(): Sunday = 0
  start.setDate(start.getDate() - daysSinceMonday);
  return start;
}

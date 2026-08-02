/**
 * Calendar-date arithmetic, ported from the web app's src/lib/utils/date.ts.
 *
 * The app deals in calendar days ("which day was this milk delivered"), never
 * in instants. Every helper here takes and returns a "YYYY-MM-DD" string, and
 * any Date used internally is anchored at noon UTC so that no timezone offset
 * can push it onto the neighbouring day — the same reasoning the server
 * documents for `parseDateOnly`.
 *
 * The one place a real clock is read is `today()`, and it is read in the
 * dairy's timezone, not the device's: a phone left on the wrong timezone must
 * still agree with the server about which day it is.
 */

/** The dairy operates on India Standard Time. */
export const APP_TIME_ZONE = "Asia/Kolkata";

/** Today in the dairy's timezone, as "YYYY-MM-DD". */
export function today(): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIME_ZONE }).format(new Date());
}

/** Anchor a calendar day at noon UTC, safe from any offset shifting the date. */
function anchor(value: string): Date {
  const [y = 0, m = 1, d = 1] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

function toKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Shift a calendar day by n days. */
export function addDays(value: string, n: number): string {
  const date = anchor(value);
  date.setUTCDate(date.getUTCDate() + n);
  return toKey(date);
}

export function isToday(value: string): boolean {
  return value === today();
}

/** True if the day is in the future relative to the dairy's today. */
export function isFuture(value: string): boolean {
  return value > today();
}

export function currentYearMonth(): { year: number; month: number } {
  const [year = 0, month = 1] = today().split("-").map(Number);
  return { year, month };
}

/**
 * A billing period always runs from the 1st to the last day of the month —
 * the single place that rule is expressed, matching the server's monthPeriod.
 */
export function monthPeriod(
  year: number,
  month: number
): { start: string; end: string; daysInMonth: number } {
  const pad = (n: number) => String(n).padStart(2, "0");
  // Day 0 of the next month is the last day of this one.
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    start: `${year}-${pad(month)}-01`,
    end: `${year}-${pad(month)}-${pad(daysInMonth)}`,
    daysInMonth,
  };
}

/** "YYYY-MM" for a year/month pair. */
export function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function parseMonthKey(key: string): { year: number; month: number } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(key);
  if (!match) return null;
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return { year: Number(match[1]), month };
}

/** Step a year/month pair by n months. */
export function shiftMonth(
  year: number,
  month: number,
  n: number
): { year: number; month: number } {
  const zeroBased = year * 12 + (month - 1) + n;
  return { year: Math.floor(zeroBased / 12), month: (zeroBased % 12) + 1 };
}

/** The last n months, newest first, as "YYYY-MM" keys. */
export function recentMonths(n: number): string[] {
  const { year, month } = currentYearMonth();
  return Array.from({ length: n }, (_, i) => {
    const shifted = shiftMonth(year, month, -i);
    return monthKey(shifted.year, shifted.month);
  });
}

/** Day-of-week for a calendar day: 0 = Sunday. */
export function dayOfWeek(value: string): number {
  return anchor(value).getUTCDay();
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export function weekdayName(value: string): string {
  return WEEKDAYS[dayOfWeek(value)] ?? "";
}

/** Every calendar day in a month, oldest first. */
export function daysOfMonth(year: number, month: number): string[] {
  const { daysInMonth } = monthPeriod(year, month);
  const pad = (n: number) => String(n).padStart(2, "0");
  return Array.from({ length: daysInMonth }, (_, i) => `${year}-${pad(month)}-${pad(i + 1)}`);
}

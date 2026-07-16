/**
 * Date-only helpers for a fixed business timezone.
 *
 * The app stores calendar dates (daily entries, bill periods) as Postgres
 * `@db.Date` values, which have no time or timezone. To keep reads and writes
 * consistent regardless of where the server runs (local dev in IST, Netlify in
 * UTC), we always represent a calendar day as a UTC-midnight Date and derive
 * "today" from the dairy's own timezone — never from the server's local clock.
 */

/** The dairy operates on India Standard Time. */
export const APP_TIME_ZONE = "Asia/Kolkata";

/** Today's calendar date in the dairy's timezone, as "YYYY-MM-DD". */
export function todayInAppTz(): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIME_ZONE }).format(new Date());
}

/**
 * Parse a "YYYY-MM-DD" string to a Date anchored at NOON UTC.
 *
 * Why noon and not midnight: when this Date is written to / compared against a
 * Postgres `@db.Date` column, the driver can shift it by the server's UTC
 * offset. Midnight UTC sits exactly on the day boundary, so any offset can flip
 * the calendar day (the classic "entry shows on the 15th here but the 16th
 * there" bug). Noon UTC is ~12h from either boundary — no real timezone offset
 * (max ±14h, and Postgres reads `date` back at 00:00) can push it to another
 * day. So reads, writes and equality queries all land on the intended day
 * regardless of where the server runs.
 */
export function parseDateOnly(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

/** Format any Date to a "YYYY-MM-DD" calendar string (UTC). */
export function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Shift a "YYYY-MM-DD" string by n days (UTC-safe), returning "YYYY-MM-DD". */
export function addDays(dateStr: string, n: number): string {
  const d = parseDateOnly(dateStr);
  d.setUTCDate(d.getUTCDate() + n);
  return toDateOnly(d);
}

/** True if the given "YYYY-MM-DD" is today in the dairy's timezone. */
export function isToday(dateStr: string): boolean {
  return dateStr === todayInAppTz();
}

/** The current year/month in the dairy's timezone. */
export function currentYearMonth(): { year: number; month: number } {
  const [year, month] = todayInAppTz().split("-").map(Number);
  return { year, month };
}

/**
 * Every month touched by a date range, as "YYYY-MM" keys (oldest first).
 *
 * Billing is always whole-month (see monthPeriod), so a range picked on a
 * calendar resolves to the months it spans: 10 May → 20 Jul bills May, June and
 * July in full. Returns [] if the range is inverted.
 */
export function monthsInRange(fromStr: string, toStr: string): string[] {
  const [fy, fm] = fromStr.split("-").map(Number);
  const [ty, tm] = toStr.split("-").map(Number);
  if (!fy || !fm || !ty || !tm) return [];
  if (fy > ty || (fy === ty && fm > tm)) return [];

  const keys: string[] = [];
  let y = fy;
  let m = fm;
  // Bounded by construction, but keep a hard stop against a bad input loop.
  while ((y < ty || (y === ty && m <= tm)) && keys.length < 240) {
    keys.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return keys;
}

/**
 * A billing period always runs from the 1st to the last day of the month —
 * the single place that rule is expressed, so every caller agrees.
 */
export function monthPeriod(year: number, month: number): {
  start: string;
  end: string;
  daysInMonth: number;
} {
  const pad = (n: number) => String(n).padStart(2, "0");
  // Day 0 of the next month = last day of this one.
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    start: `${year}-${pad(month)}-01`,
    end: `${year}-${pad(month)}-${pad(daysInMonth)}`,
    daysInMonth,
  };
}

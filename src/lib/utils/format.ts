import { parseISO } from "date-fns";

/**
 * Resolve a calendar-date input to a Date that is safe to format in UTC.
 *
 * Everything the app displays as a date (bill periods, entry dates, start
 * dates, payment dates) is a Postgres `@db.Date` — a calendar day with no time
 * or zone. Those arrive as UTC midnight ("2026-07-01T00:00:00.000Z"). Formatting
 * that in the viewer's local zone shows the PREVIOUS day west of UTC (a Jul 1
 * period rendered as "30 Jun"), so all date formatting below is pinned to UTC.
 *
 * A bare "YYYY-MM-DD" string is anchored at noon UTC instead of being parsed as
 * local midnight — otherwise it would shift the other way east of UTC.
 */
function toFormattableDate(date: Date | string): Date {
  if (typeof date !== "string") return date;
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [y, m, d] = date.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  }
  return parseISO(date);
}

const DATE_FMT = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const DATE_SHORT_FMT = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});
const MONTH_FMT = new Intl.DateTimeFormat("en-GB", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export function formatCurrency(amount: number | string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(num);
}

export function formatLiters(liters: number | string | null | undefined): string {
  if (liters === null || liters === undefined) return "—";
  const num = typeof liters === "string" ? parseFloat(liters) : liters;
  return `${num.toFixed(1)} L`;
}

/** "01 Jul 2026" — always the stored calendar day, never shifted by timezone. */
export function formatDate(date: Date | string): string {
  return DATE_FMT.format(toFormattableDate(date));
}

/** "01/07/2026" */
export function formatDateShort(date: Date | string): string {
  return DATE_SHORT_FMT.format(toFormattableDate(date));
}

/** "July 2026" */
export function formatMonth(date: Date | string): string {
  return MONTH_FMT.format(toFormattableDate(date));
}

export function formatPeriod(start: Date | string, end: Date | string): string {
  return `${formatDate(start)} – ${formatDate(end)}`;
}

export function decimalToNumber(val: unknown): number {
  if (val === null || val === undefined) return 0;
  return parseFloat(String(val));
}

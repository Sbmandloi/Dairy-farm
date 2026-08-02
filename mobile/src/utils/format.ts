/**
 * Display formatting, ported from the web app's src/lib/utils/format.ts.
 *
 * The rules are copied deliberately rather than reinvented: a bill that reads
 * "₹1,250.00" in the browser must read "₹1,250.00" on the phone, and a period
 * starting 01 Jul must never render as 30 Jun because the device happens to sit
 * west of UTC.
 *
 * Every calendar date arriving from the API is a "YYYY-MM-DD" string. Those are
 * formatted from their parts, never through `new Date(str)`, because that
 * parses as UTC midnight and then renders in device-local time — which is
 * exactly the off-by-one-day bug the web app documents at length.
 */

const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const CALENDAR_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

function parts(value: string): { year: number; month: number; day: number } | null {
  const match = CALENDAR_DAY.exec(value);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

/** "₹1,250.00" — Indian digit grouping, as the web app and the PDFs use. */
export function formatCurrency(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const negative = safe < 0;
  const [whole = "0", fraction = "00"] = Math.abs(safe).toFixed(2).split(".");

  // Indian grouping: last three digits, then pairs (12,34,567).
  const last3 = whole.slice(-3);
  const rest = whole.slice(0, -3);
  const grouped = rest
    ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${last3}`
    : last3;

  return `${negative ? "-" : ""}₹${grouped}.${fraction}`;
}

/** "₹1,250" — for dense tiles where the paise add noise, not information. */
export function formatCurrencyCompact(amount: number): string {
  return formatCurrency(amount).replace(/\.\d{2}$/, "");
}

export function formatLiters(liters: number | null | undefined): string {
  if (liters === null || liters === undefined || !Number.isFinite(liters)) return "—";
  return `${liters.toFixed(1)} L`;
}

/** "01 Aug 2026" */
export function formatDate(value: string): string {
  const p = parts(value);
  if (!p) return value;
  return `${String(p.day).padStart(2, "0")} ${MONTHS_SHORT[p.month - 1]} ${p.year}`;
}

/** "01 Aug" — when the year is already established by context. */
export function formatDayMonth(value: string): string {
  const p = parts(value);
  if (!p) return value;
  return `${String(p.day).padStart(2, "0")} ${MONTHS_SHORT[p.month - 1]}`;
}

/** "August 2026" */
export function formatMonth(value: string): string {
  const p = parts(value);
  if (p) return `${MONTHS_LONG[p.month - 1]} ${p.year}`;

  // Also accepts a "YYYY-MM" statement key.
  const key = /^(\d{4})-(\d{2})$/.exec(value);
  if (key) return `${MONTHS_LONG[Number(key[2]) - 1]} ${key[1]}`;

  return value;
}

/** "Aug 2026" */
export function formatMonthShort(value: string): string {
  const key = /^(\d{4})-(\d{2})/.exec(value);
  if (!key) return value;
  return `${MONTHS_SHORT[Number(key[2]) - 1]} ${key[1]}`;
}

export function formatPeriod(start: string, end: string): string {
  return `${formatDate(start)} – ${formatDate(end)}`;
}

/** "+91 98765 43210" — matches the web's displayPhone. */
export function displayPhone(phone: string | null): string {
  if (!phone) return "—";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  return phone;
}

/**
 * "2 days ago" for a timestamp — used where the exact instant is noise but
 * staleness is the point (last reminder sent, last backup taken).
 */
export function formatRelative(iso: string | null): string {
  if (!iso) return "never";

  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "never";

  const seconds = Math.floor((Date.now() - then) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    return `${m} minute${m === 1 ? "" : "s"} ago`;
  }
  if (seconds < 86_400) {
    const h = Math.floor(seconds / 3600);
    return `${h} hour${h === 1 ? "" : "s"} ago`;
  }
  const d = Math.floor(seconds / 86_400);
  if (d < 30) return `${d} day${d === 1 ? "" : "s"} ago`;
  const months = Math.floor(d / 30);
  return `${months} month${months === 1 ? "" : "s"} ago`;
}

/** Initials for an avatar, from a customer's name. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return `${words[0]![0]}${words[words.length - 1]![0]}`.toUpperCase();
}

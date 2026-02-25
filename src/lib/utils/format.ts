import { format, parseISO } from "date-fns";

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

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "dd MMM yyyy");
}

export function formatDateShort(date: Date | string): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "dd/MM/yyyy");
}

export function formatMonth(date: Date | string): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "MMMM yyyy");
}

export function formatPeriod(start: Date | string, end: Date | string): string {
  return `${formatDate(start)} – ${formatDate(end)}`;
}

export function decimalToNumber(val: unknown): number {
  if (val === null || val === undefined) return 0;
  return parseFloat(String(val));
}

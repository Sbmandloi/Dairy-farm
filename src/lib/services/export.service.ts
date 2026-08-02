import { prisma } from "@/lib/db";
import { recordBackupTaken } from "./settings.service";

/**
 * CSV and JSON exports, shared by the web download buttons and the Android app.
 *
 * The builders were lifted verbatim out of the `/api/export/*` route handlers so
 * both clients produce byte-identical files. Each returns the filename with the
 * content, because the filename encodes what the export covers and the two must
 * not drift apart.
 */

export interface ExportFile {
  filename: string;
  content: string;
  contentType: string;
}

/** RFC 4180 quoting — a name containing a comma must not split the row. */
function escape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

/** Prisma Decimal → fixed-2 string, or "" for a null. */
function money(value: unknown): string {
  return value === null || value === undefined ? "" : parseFloat(String(value)).toFixed(2);
}

function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/**
 * Per-customer summary CSV. `period` is "all" or "YYYY-MM"; a month narrows both
 * the bills and the daily entries counted, so the figures describe that month
 * rather than the customer's lifetime.
 */
export async function buildCustomersCsv(period = "all"): Promise<ExportFile> {
  let dateFilter: { gte?: Date; lte?: Date } | undefined;
  let filename = "customers-all.csv";

  if (period !== "all") {
    const [year, month] = period.split("-").map(Number);
    if (!isNaN(year) && !isNaN(month)) {
      dateFilter = { gte: new Date(year, month - 1, 1), lte: new Date(year, month, 0) };
      filename = `customers-${period}.csv`;
    }
  }

  const customers = await prisma.customer.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
    include: {
      bills: {
        where: dateFilter
          ? { periodStart: { gte: dateFilter.gte }, periodEnd: { lte: dateFilter.lte } }
          : undefined,
        select: { totalAmount: true, totalLiters: true, payments: { select: { amountPaid: true } } },
      },
      dailyEntries: {
        where: dateFilter ? { date: dateFilter } : undefined,
        select: { totalLiters: true },
      },
    },
  });

  const rows: string[] = [
    "Name,Phone,Address,Status,Total Days,Total Liters (L),Total Billed (₹),Total Paid (₹),Balance (₹),Custom Price/L",
  ];

  for (const c of customers) {
    const totalLiters = c.dailyEntries.reduce((s, e) => s + parseFloat(String(e.totalLiters)), 0);
    const totalBilled = c.bills.reduce((s, b) => s + parseFloat(String(b.totalAmount)), 0);
    const totalPaid = c.bills
      .flatMap((b) => b.payments)
      .reduce((s, p) => s + parseFloat(String(p.amountPaid)), 0);

    rows.push(
      [
        escape(c.name),
        escape(c.phoneNumber ?? ""),
        escape(c.address || ""),
        c.isActive ? "Active" : "Inactive",
        String(c.dailyEntries.length),
        totalLiters.toFixed(2),
        totalBilled.toFixed(2),
        totalPaid.toFixed(2),
        (totalBilled - totalPaid).toFixed(2),
        c.pricePerLiter ? parseFloat(String(c.pricePerLiter)).toFixed(2) : "",
      ].join(",")
    );
  }

  return { filename, content: rows.join("\n"), contentType: "text/csv; charset=utf-8" };
}

/** Resolve an export window from a period selector. */
function resolveRange(type: string, value: string): { start: Date; end: Date; label: string } {
  if (type === "all") {
    return { start: new Date("2000-01-01"), end: new Date("2099-12-31"), label: "all-time" };
  }

  if (type === "week" && value) {
    // "YYYY-WXX". ISO week 1 is the week containing Jan 4th.
    const [yearStr, weekStr] = value.split("-W");
    const year = parseInt(yearStr);
    const week = parseInt(weekStr);
    const jan4 = new Date(year, 0, 4);
    const dayOfWeek = jan4.getDay() || 7; // Mon = 1
    const week1Mon = new Date(jan4);
    week1Mon.setDate(jan4.getDate() - (dayOfWeek - 1));
    const start = new Date(week1Mon);
    start.setDate(week1Mon.getDate() + (week - 1) * 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start, end, label: `week-${value}` };
  }

  const period = value || new Date().toISOString().slice(0, 7);
  const [yearStr, monthStr] = period.split("-");
  const year = parseInt(yearStr);
  const month = parseInt(monthStr);
  return {
    start: new Date(year, month - 1, 1),
    end: new Date(year, month, 0),
    label: `month-${period}`,
  };
}

/**
 * Multi-section human-readable CSV for a month, an ISO week, or all time:
 * daily entries, then bills, then payments.
 *
 * This is a *report*, not a restorable backup — it drops primary keys, so it
 * deliberately does not stamp `lastBackupAt`.
 */
export async function buildBackupCsv(type = "month", value = ""): Promise<ExportFile> {
  const { start, end, label } = resolveRange(type, value);

  const [entries, bills] = await Promise.all([
    prisma.dailyMilkEntry.findMany({
      where: { date: { gte: start, lte: end } },
      include: { customer: { select: { name: true, phoneNumber: true } } },
      orderBy: [{ date: "asc" }, { customer: { name: "asc" } }],
    }),
    prisma.bill.findMany({
      where: { periodStart: { gte: start }, periodEnd: { lte: end } },
      include: { customer: { select: { name: true, phoneNumber: true } }, payments: true },
      orderBy: { periodStart: "asc" },
    }),
  ]);

  const rows: string[] = [
    `# Dairy Billing Backup — ${label}`,
    `# Generated: ${new Date().toISOString()}`,
    "",
    "## DAILY MILK ENTRIES",
    "Date,Customer Name,Phone,Morning (L),Evening (L),Total (L),Notes",
  ];

  for (const e of entries) {
    rows.push(
      [
        dateOnly(e.date),
        escape(e.customer.name),
        escape(e.customer.phoneNumber ?? ""),
        e.morningLiters ? money(e.morningLiters) : "",
        e.eveningLiters ? money(e.eveningLiters) : "",
        money(e.totalLiters),
        escape(e.notes || ""),
      ].join(",")
    );
  }

  rows.push(
    "",
    "## BILLS",
    "Invoice,Customer Name,Phone,Period Start,Period End,Total Liters,Price/L,Total Amount,Status"
  );

  for (const b of bills) {
    rows.push(
      [
        escape(b.invoiceNumber),
        escape(b.customer.name),
        escape(b.customer.phoneNumber ?? ""),
        dateOnly(b.periodStart),
        dateOnly(b.periodEnd),
        money(b.totalLiters),
        money(b.pricePerLiter),
        money(b.totalAmount),
        b.status,
      ].join(",")
    );
  }

  rows.push("", "## PAYMENTS", "Invoice,Customer Name,Amount Paid,Paid On,Note");

  for (const b of bills) {
    for (const p of b.payments) {
      rows.push(
        [
          escape(b.invoiceNumber),
          escape(b.customer.name),
          money(p.amountPaid),
          dateOnly(p.paidOn),
          escape(p.note || ""),
        ].join(",")
      );
    }
  }

  return {
    filename: `dairy-backup-${label}.csv`,
    content: rows.join("\n"),
    contentType: "text/csv; charset=utf-8",
  };
}

/**
 * Full-fidelity, machine-restorable snapshot of the ENTIRE database.
 *
 * Unlike the CSV exports this preserves primary keys, foreign keys, decimals and
 * timestamps, so it can be re-imported via `npm run db:restore <file.json>`.
 * Prisma Decimal serializes to a numeric string and DateTime to an ISO string
 * through JSON.stringify, so no lossy float conversion happens here.
 *
 * This is the only export that stamps `lastBackupAt`, because it is the only one
 * that could actually rebuild the database — counting a CSV would make the
 * "last backup" badge lie about how protected the data is.
 */
export async function buildFullBackupJson(generatedBy: string | null): Promise<ExportFile> {
  // Ordered parent-before-child so a naive sequential restore satisfies FKs.
  const [users, settings, customers, dailyMilkEntries, bills, payments] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.settings.findMany(),
    prisma.customer.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.dailyMilkEntry.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.bill.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.payment.findMany({ orderBy: { createdAt: "asc" } }),
  ]);

  const snapshot = {
    meta: {
      app: "dairy-billing",
      backupVersion: 1,
      migration: "0_init",
      generatedAt: new Date().toISOString(),
      generatedBy,
      counts: {
        users: users.length,
        settings: settings.length,
        customers: customers.length,
        dailyMilkEntries: dailyMilkEntries.length,
        bills: bills.length,
        payments: payments.length,
      },
    },
    data: { users, settings, customers, dailyMilkEntries, bills, payments },
  };

  const content = JSON.stringify(snapshot, null, 2);
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");

  // Stamp only once the snapshot actually serialized — a failed export must not
  // report "backed up just now". Never let this break the download itself: the
  // file in the user's hands is the real backup.
  try {
    await recordBackupTaken();
  } catch (e) {
    console.error("Could not record lastBackupAt:", e);
  }

  return {
    filename: `dairy-backup-full-${stamp}.json`,
    content,
    contentType: "application/json; charset=utf-8",
  };
}

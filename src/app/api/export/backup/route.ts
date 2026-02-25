import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

// GET /api/export/backup?type=month&value=YYYY-MM
// GET /api/export/backup?type=week&value=YYYY-WXX  (ISO week)
// GET /api/export/backup?type=all
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "month";
  const value = searchParams.get("value") || "";

  let start: Date;
  let end: Date;
  let label = "backup";

  if (type === "all") {
    start = new Date("2000-01-01");
    end = new Date("2099-12-31");
    label = "all-time";
  } else if (type === "week" && value) {
    // value = "YYYY-WXX" e.g. "2025-W05"
    const [yearStr, weekStr] = value.split("-W");
    const year = parseInt(yearStr);
    const week = parseInt(weekStr);
    // ISO week 1 is the week containing Jan 4th
    const jan4 = new Date(year, 0, 4);
    const dayOfWeek = jan4.getDay() || 7; // Mon=1
    const week1Mon = new Date(jan4);
    week1Mon.setDate(jan4.getDate() - (dayOfWeek - 1));
    start = new Date(week1Mon);
    start.setDate(week1Mon.getDate() + (week - 1) * 7);
    end = new Date(start);
    end.setDate(start.getDate() + 6);
    label = `week-${value}`;
  } else {
    // month: value = "YYYY-MM"
    const [yearStr, monthStr] = (value || new Date().toISOString().slice(0, 7)).split("-");
    const year = parseInt(yearStr);
    const month = parseInt(monthStr);
    start = new Date(year, month - 1, 1);
    end = new Date(year, month, 0);
    label = `month-${value || new Date().toISOString().slice(0, 7)}`;
  }

  const entries = await prisma.dailyMilkEntry.findMany({
    where: { date: { gte: start, lte: end } },
    include: { customer: { select: { name: true, phoneNumber: true } } },
    orderBy: [{ date: "asc" }, { customer: { name: "asc" } }],
  });

  const bills = await prisma.bill.findMany({
    where: { periodStart: { gte: start }, periodEnd: { lte: end } },
    include: {
      customer: { select: { name: true, phoneNumber: true } },
      payments: true,
    },
    orderBy: { periodStart: "asc" },
  });

  // Build multi-section CSV
  const rows: string[] = [];

  rows.push(`# Dairy Billing Backup — ${label}`);
  rows.push(`# Generated: ${new Date().toISOString()}`);
  rows.push("");
  rows.push("## DAILY MILK ENTRIES");
  rows.push("Date,Customer Name,Phone,Morning (L),Evening (L),Total (L),Notes");

  for (const e of entries) {
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    rows.push(
      [
        e.date.toISOString().slice(0, 10),
        escape(e.customer.name),
        escape(e.customer.phoneNumber),
        e.morningLiters ? parseFloat(String(e.morningLiters)).toFixed(2) : "",
        e.eveningLiters ? parseFloat(String(e.eveningLiters)).toFixed(2) : "",
        parseFloat(String(e.totalLiters)).toFixed(2),
        escape(e.notes || ""),
      ].join(",")
    );
  }

  rows.push("");
  rows.push("## BILLS");
  rows.push(
    "Invoice,Customer Name,Phone,Period Start,Period End,Total Liters,Price/L,Total Amount,Status"
  );

  for (const b of bills) {
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    rows.push(
      [
        escape(b.invoiceNumber),
        escape(b.customer.name),
        escape(b.customer.phoneNumber),
        b.periodStart.toISOString().slice(0, 10),
        b.periodEnd.toISOString().slice(0, 10),
        parseFloat(String(b.totalLiters)).toFixed(2),
        parseFloat(String(b.pricePerLiter)).toFixed(2),
        parseFloat(String(b.totalAmount)).toFixed(2),
        b.status,
      ].join(",")
    );
  }

  rows.push("");
  rows.push("## PAYMENTS");
  rows.push("Invoice,Customer Name,Amount Paid,Paid On,Note");

  for (const b of bills) {
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    for (const p of b.payments) {
      rows.push(
        [
          escape(b.invoiceNumber),
          escape(b.customer.name),
          parseFloat(String(p.amountPaid)).toFixed(2),
          p.paidOn.toISOString().slice(0, 10),
          escape(p.note || ""),
        ].join(",")
      );
    }
  }

  const csv = rows.join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="dairy-backup-${label}.csv"`,
    },
  });
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period") || "all"; // "all" | "YYYY-MM"

  let dateFilter: { gte?: Date; lte?: Date } | undefined;
  let filename = "customers-all.csv";

  if (period !== "all") {
    const [year, month] = period.split("-").map(Number);
    if (!isNaN(year) && !isNaN(month)) {
      dateFilter = {
        gte: new Date(year, month - 1, 1),
        lte: new Date(year, month, 0),
      };
      filename = `customers-${period}.csv`;
    }
  }

  const customers = await prisma.customer.findMany({
    orderBy: { name: "asc" },
    include: {
      bills: {
        where: dateFilter
          ? {
              periodStart: { gte: dateFilter.gte },
              periodEnd: { lte: dateFilter.lte },
            }
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
    const totalLiters = c.dailyEntries.reduce(
      (s, e) => s + parseFloat(String(e.totalLiters)),
      0
    );
    const totalBilled = c.bills.reduce(
      (s, b) => s + parseFloat(String(b.totalAmount)),
      0
    );
    const totalPaid = c.bills
      .flatMap((b) => b.payments)
      .reduce((s, p) => s + parseFloat(String(p.amountPaid)), 0);
    const balance = totalBilled - totalPaid;
    const customPrice = c.pricePerLiter ? parseFloat(String(c.pricePerLiter)).toFixed(2) : "";

    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    rows.push(
      [
        escape(c.name),
        escape(c.phoneNumber),
        escape(c.address || ""),
        c.isActive ? "Active" : "Inactive",
        c.dailyEntries.length.toString(),
        totalLiters.toFixed(2),
        totalBilled.toFixed(2),
        totalPaid.toFixed(2),
        balance.toFixed(2),
        customPrice,
      ].join(",")
    );
  }

  const csv = rows.join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

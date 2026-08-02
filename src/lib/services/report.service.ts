import { prisma } from "@/lib/db";
import { getSettings } from "./settings.service";
import { decimalToNumber } from "@/lib/utils/format";

/**
 * Everything the Reports screen shows, in one place.
 *
 * These queries previously lived inline in the Reports page. They were lifted
 * here unchanged so the web page and the Android app read the same numbers from
 * the same statements — a report that disagreed between the two would be worse
 * than no report at all.
 *
 * Archived (soft-deleted) customers are excluded from every figure, matching
 * every other surface in the app.
 */

/** Reports never count archived customers. */
const liveCustomer = { customer: { deletedAt: null } };
const liveViaBill = { bill: { customer: { deletedAt: null } } };

export interface MonthlySummaryRow {
  /** First day of the billing month, "YYYY-MM-DD". */
  periodStart: string;
  year: number;
  month: number;
  bills: number;
  liters: number;
  amount: number;
}

export interface TopCustomerRow {
  customerId: string;
  name: string;
  liters: number;
}

export interface RecentPaymentRow {
  id: string;
  billId: string;
  customerName: string;
  invoiceNumber: string;
  amount: number;
  paidOn: string;
}

export interface ReportsData {
  allTime: {
    totalBills: number;
    totalLiters: number;
    totalBilled: number;
    totalCollected: number;
    outstanding: number;
  };
  /** The month the "top customers" table covers, "YYYY-MM". */
  currentMonth: string;
  monthlySummary: MonthlySummaryRow[];
  topCustomers: TopCustomerRow[];
  recentPayments: RecentPaymentRow[];
  lastBackupAt: string | null;
}

export async function getReportsData(): Promise<ReportsData> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const [monthlySummary, recentPayments, topCustomers, totalAllTime, totalPayments, settings] =
    await Promise.all([
      prisma.bill.groupBy({
        by: ["periodStart"],
        where: liveCustomer,
        _sum: { totalAmount: true, totalLiters: true },
        _count: true,
        orderBy: { periodStart: "desc" },
        take: 12,
      }),
      prisma.payment.findMany({
        where: liveViaBill,
        take: 20,
        orderBy: { createdAt: "desc" },
        include: { bill: { include: { customer: true } } },
      }),
      prisma.dailyMilkEntry.groupBy({
        by: ["customerId"],
        where: { date: { gte: monthStart, lte: monthEnd }, ...liveCustomer },
        _sum: { totalLiters: true },
        orderBy: { _sum: { totalLiters: "desc" } },
        take: 10,
      }),
      prisma.bill.aggregate({
        where: liveCustomer,
        _sum: { totalAmount: true, totalLiters: true },
        _count: true,
      }),
      prisma.payment.aggregate({ where: liveViaBill, _sum: { amountPaid: true } }),
      getSettings(),
    ]);

  // Resolve names for the ranked customers in one query rather than per row.
  const customers = await prisma.customer.findMany({
    where: { id: { in: topCustomers.map((c) => c.customerId) } },
    select: { id: true, name: true },
  });
  const nameById = new Map(customers.map((c) => [c.id, c.name]));

  const totalBilled = decimalToNumber(totalAllTime._sum.totalAmount);
  const totalCollected = decimalToNumber(totalPayments._sum.amountPaid);

  return {
    allTime: {
      totalBills: totalAllTime._count,
      totalLiters: decimalToNumber(totalAllTime._sum.totalLiters),
      totalBilled,
      totalCollected,
      outstanding: totalBilled - totalCollected,
    },
    currentMonth: `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, "0")}`,
    monthlySummary: monthlySummary.map((row) => ({
      periodStart: row.periodStart.toISOString().slice(0, 10),
      year: row.periodStart.getUTCFullYear(),
      month: row.periodStart.getUTCMonth() + 1,
      bills: row._count,
      liters: decimalToNumber(row._sum.totalLiters),
      amount: decimalToNumber(row._sum.totalAmount),
    })),
    topCustomers: topCustomers.map((row) => ({
      customerId: row.customerId,
      name: nameById.get(row.customerId) ?? "Unknown",
      liters: decimalToNumber(row._sum.totalLiters),
    })),
    recentPayments: recentPayments.map((p) => ({
      id: p.id,
      billId: p.billId,
      customerName: p.bill.customer.name,
      invoiceNumber: p.bill.invoiceNumber,
      amount: decimalToNumber(p.amountPaid),
      paidOn: p.paidOn.toISOString().slice(0, 10),
    })),
    lastBackupAt: settings.lastBackupAt ? settings.lastBackupAt.toISOString() : null,
  };
}

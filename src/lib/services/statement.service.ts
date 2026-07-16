import { prisma } from "@/lib/db";
import { generateBillsForPeriod } from "./billing.service";
import { monthPeriod, parseDateOnly } from "@/lib/utils/date";
import { decimalToNumber } from "@/lib/utils/format";

/** One month's line on a consolidated statement. */
export type StatementMonth = {
  /** "YYYY-MM" */
  key: string;
  year: number;
  month: number;
  billId: string;
  invoiceNumber: string;
  periodStart: Date;
  periodEnd: Date;
  liters: number;
  pricePerLiter: number;
  amount: number;
  paid: number;
  due: number;
};

export type Statement = {
  customer: { id: string; name: string; phoneNumber: string | null; address: string | null };
  months: StatementMonth[];
  /** Selected months that had no milk entries, so no bill exists for them. */
  emptyMonths: string[];
  totals: { liters: number; amount: number; paid: number; due: number };
  notes?: string | null;
};

/**
 * Build a consolidated statement for a customer across one or more months.
 *
 * Quantities are summed from the customer's daily entries and the rate comes
 * from the database (their custom price, else the global rate) — nothing is
 * hand-entered. Each selected month is generated through the SAME
 * generateBillsForPeriod path as the Billing page, so a month always resolves to
 * exactly one Bill (1st → last day) with a stable invoice number, and payments
 * recorded anywhere are reflected here.
 *
 * Months with no entries produce no bill and are reported back as `emptyMonths`
 * rather than showing a ₹0 line.
 */
export async function buildCustomerStatement(
  customerId: string,
  monthKeys: string[],
  notes?: string | null
): Promise<Statement> {
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) throw new Error("Customer not found");
  if (customer.deletedAt) throw new Error(`${customer.name} is archived.`);
  if (monthKeys.length === 0) throw new Error("Select at least one month.");

  // Oldest month first, de-duplicated.
  const keys = [...new Set(monthKeys)].sort();

  const months: StatementMonth[] = [];
  const emptyMonths: string[] = [];

  for (const key of keys) {
    const [year, month] = key.split("-").map(Number);
    if (!year || !month || month < 1 || month > 12) continue;

    const { start, end } = monthPeriod(year, month);
    const periodStart = parseDateOnly(start);
    const periodEnd = parseDateOnly(end);

    // Upsert this month's bill (skips months with zero liters).
    await generateBillsForPeriod(periodStart, periodEnd, customerId);

    const bill = await prisma.bill.findUnique({
      where: { customerId_periodStart_periodEnd: { customerId, periodStart, periodEnd } },
      include: { payments: true },
    });

    if (!bill) {
      emptyMonths.push(key);
      continue;
    }

    const amount = decimalToNumber(bill.totalAmount);
    const paid = bill.payments.reduce((s, p) => s + decimalToNumber(p.amountPaid), 0);

    months.push({
      key,
      year,
      month,
      billId: bill.id,
      invoiceNumber: bill.invoiceNumber,
      periodStart: bill.periodStart,
      periodEnd: bill.periodEnd,
      liters: decimalToNumber(bill.totalLiters),
      pricePerLiter: decimalToNumber(bill.pricePerLiter),
      amount,
      paid,
      due: Math.max(0, amount - paid),
    });
  }

  const totals = months.reduce(
    (acc, m) => ({
      liters: acc.liters + m.liters,
      amount: acc.amount + m.amount,
      paid: acc.paid + m.paid,
      due: acc.due + m.due,
    }),
    { liters: 0, amount: 0, paid: 0, due: 0 }
  );

  return {
    customer: {
      id: customer.id,
      name: customer.name,
      phoneNumber: customer.phoneNumber,
      address: customer.address,
    },
    months,
    emptyMonths,
    totals,
    notes: notes?.trim() || null,
  };
}

/**
 * Preview the numbers WITHOUT creating any bills — what the UI shows while the
 * user is still choosing months.
 */
export async function previewCustomerStatement(
  customerId: string,
  monthKeys: string[]
): Promise<{
  months: { key: string; liters: number; pricePerLiter: number; amount: number; paid: number }[];
  emptyMonths: string[];
  totals: { liters: number; amount: number; paid: number; due: number };
}> {
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) throw new Error("Customer not found");

  const settings = await prisma.settings.findUnique({ where: { id: "default" } });
  const globalPrice = settings ? decimalToNumber(settings.globalPricePerLiter) : 0;
  const price =
    customer.pricePerLiter != null ? decimalToNumber(customer.pricePerLiter) : globalPrice;

  const keys = [...new Set(monthKeys)].sort();
  const months: { key: string; liters: number; pricePerLiter: number; amount: number; paid: number }[] = [];
  const emptyMonths: string[] = [];

  for (const key of keys) {
    const [year, month] = key.split("-").map(Number);
    if (!year || !month) continue;
    const { start, end } = monthPeriod(year, month);
    const periodStart = parseDateOnly(start);
    const periodEnd = parseDateOnly(end);

    const agg = await prisma.dailyMilkEntry.aggregate({
      where: { customerId, date: { gte: periodStart, lte: periodEnd } },
      _sum: { totalLiters: true },
    });
    const liters = decimalToNumber(agg._sum.totalLiters);
    if (liters <= 0) {
      emptyMonths.push(key);
      continue;
    }

    // Any payments already recorded against an existing bill for this month.
    const existing = await prisma.bill.findUnique({
      where: { customerId_periodStart_periodEnd: { customerId, periodStart, periodEnd } },
      include: { payments: true },
    });
    const paid =
      existing?.payments.reduce((s, p) => s + decimalToNumber(p.amountPaid), 0) ?? 0;

    months.push({
      key,
      liters,
      pricePerLiter: price,
      amount: Math.round(liters * price * 100) / 100,
      paid,
    });
  }

  const totals = months.reduce(
    (acc, m) => ({
      liters: acc.liters + m.liters,
      amount: acc.amount + m.amount,
      paid: acc.paid + m.paid,
      due: acc.due + Math.max(0, m.amount - m.paid),
    }),
    { liters: 0, amount: 0, paid: 0, due: 0 }
  );

  return { months, emptyMonths, totals };
}

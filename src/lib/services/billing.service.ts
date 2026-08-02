import { prisma } from "@/lib/db";
import { getSettings } from "./settings.service";
import { generateInvoiceNumber } from "@/lib/utils/invoice-number";

/**
 * Bills for a period that should be surfaced to the user (listed, printed).
 *
 * Only ACTIVE, non-archived customers — matching who bills are generated for in
 * the first place. A customer billed while active and later deactivated still
 * has the bill in the database (and their dues still show in the customer
 * manager / dashboard, where collecting matters), but they are not re-printed
 * or re-sent as part of the month's run.
 */
export async function getBillsForPeriod(periodStart: Date, periodEnd: Date) {
  return prisma.bill.findMany({
    where: {
      periodStart,
      periodEnd,
      customer: { isActive: true, deletedAt: null },
    },
    include: { customer: true, payments: true },
    orderBy: { customer: { name: "asc" } },
  });
}

export async function getCustomersWithBillsForPeriod(periodStart: Date, periodEnd: Date) {
  const [customers, bills] = await Promise.all([
    prisma.customer.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: { name: "asc" },
    }),
    prisma.bill.findMany({
      where: { periodStart, periodEnd, customer: { isActive: true, deletedAt: null } },
      include: { payments: true },
    }),
  ]);

  const billMap = new Map(bills.map((b) => [b.customerId, b]));
  return customers.map((c) => ({ customer: c, bill: billMap.get(c.id) ?? null }));
}

export async function getBillById(id: string) {
  return prisma.bill.findUnique({
    where: { id },
    include: { customer: true, payments: true },
  });
}

/**
 * A month's run is one aggregate plus one upsert per customer, and every NEW
 * bill additionally calls generateInvoiceNumber, which scans the year's
 * invoices. Against a remote database (Neon in production) that comfortably
 * exceeds Prisma's 5s default interactive-transaction deadline once a dairy has
 * more than a handful of customers — and the whole batch is then rolled back
 * part-way through, so no bills are generated at all.
 *
 * Only the deadline changes; the work and its ordering are untouched. Still
 * bounded, so a genuinely stuck run cannot hold a connection open forever.
 */
const GENERATE_BILLS_TX = { timeout: 120_000, maxWait: 15_000 } as const;

export async function generateBillsForPeriod(
  periodStart: Date,
  periodEnd: Date,
  customerId?: string
) {
  // Archived (soft-deleted) customers must never be billed.
  const customers = await prisma.customer.findMany({
    where: { isActive: true, deletedAt: null, ...(customerId ? { id: customerId } : {}) },
  });

  const settings = await getSettings();

  return prisma.$transaction(async (tx) => {
    const bills = [];
    for (const customer of customers) {
      const agg = await tx.dailyMilkEntry.aggregate({
        where: {
          customerId: customer.id,
          date: { gte: periodStart, lte: periodEnd },
        },
        _sum: { totalLiters: true },
      });

      const totalLiters = parseFloat(String(agg._sum.totalLiters ?? 0));
      if (totalLiters === 0) continue;

      const pricePerLiter = parseFloat(
        String(customer.pricePerLiter ?? settings.globalPricePerLiter)
      );
      const totalAmount = Math.round(totalLiters * pricePerLiter * 100) / 100;

      const existing = await tx.bill.findUnique({
        where: {
          customerId_periodStart_periodEnd: {
            customerId: customer.id,
            periodStart,
            periodEnd,
          },
        },
      });

      const invoiceNumber = existing?.invoiceNumber ?? (await generateInvoiceNumber(customer.id, periodStart));

      const bill = await tx.bill.upsert({
        where: {
          customerId_periodStart_periodEnd: {
            customerId: customer.id,
            periodStart,
            periodEnd,
          },
        },
        create: {
          customerId: customer.id,
          periodStart,
          periodEnd,
          totalLiters,
          pricePerLiter,
          totalAmount,
          invoiceNumber,
          status: "GENERATED",
        },
        update: {
          totalLiters,
          pricePerLiter,
          totalAmount,
          status: "GENERATED",
        },
      });
      bills.push(bill);
    }
    return bills;
  }, GENERATE_BILLS_TX);
}

export async function markBillPaid(billId: string, amountPaid: number, paidOn: Date, note?: string) {
  const bill = await prisma.bill.findUniqueOrThrow({
    where: { id: billId },
    include: { payments: true },
  });

  await prisma.payment.create({
    data: { billId, amountPaid, paidOn, note },
  });

  const totalPaid = bill.payments.reduce((s, p) => s + parseFloat(String(p.amountPaid)), 0) + amountPaid;
  const billAmount = parseFloat(String(bill.totalAmount));

  const status = totalPaid >= billAmount ? "PAID" : "PARTIALLY_PAID";
  return prisma.bill.update({ where: { id: billId }, data: { status } });
}

export async function updateBillStatus(billId: string, status: string) {
  return prisma.bill.update({ where: { id: billId }, data: { status: status as never } });
}

export async function updateBillWhatsApp(billId: string, msgId: string) {
  return prisma.bill.update({
    where: { id: billId },
    data: { status: "SENT", whatsappMsgId: msgId, sentAt: new Date() },
  });
}

function toDateOnly(d: Date): Date {
  const y = d.getFullYear();
  const m = d.getMonth();
  const day = d.getDate();
  return new Date(Date.UTC(y, m, day));
}

export async function createManualBill(data: {
  customerId: string;
  periodStart: Date;
  periodEnd: Date;
  totalLiters: number;
  pricePerLiter: number;
  notes?: string;
}) {
  const totalAmount = Math.round(data.totalLiters * data.pricePerLiter * 100) / 100;
  const periodStart = toDateOnly(data.periodStart);
  const periodEnd = toDateOnly(data.periodEnd);

  const existing = await prisma.bill.findUnique({
    where: {
      customerId_periodStart_periodEnd: {
        customerId: data.customerId,
        periodStart,
        periodEnd,
      },
    },
  });

  const invoiceNumber = existing?.invoiceNumber ?? (await generateInvoiceNumber(data.customerId, periodStart));

  try {
    return await prisma.bill.upsert({
      where: {
        customerId_periodStart_periodEnd: {
          customerId: data.customerId,
          periodStart,
          periodEnd,
        },
      },
      create: {
        customerId: data.customerId,
        periodStart,
        periodEnd,
        totalLiters: data.totalLiters,
        pricePerLiter: data.pricePerLiter,
        totalAmount,
        invoiceNumber,
        status: "GENERATED",
      },
      update: {
        totalLiters: data.totalLiters,
        pricePerLiter: data.pricePerLiter,
        totalAmount,
        status: "GENERATED",
      },
      include: { customer: true, payments: true },
    });
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err.code === "P2002") {
      return prisma.bill.update({
        where: {
          customerId_periodStart_periodEnd: {
            customerId: data.customerId,
            periodStart,
            periodEnd,
          },
        },
        data: {
          totalLiters: data.totalLiters,
          pricePerLiter: data.pricePerLiter,
          totalAmount,
          status: "GENERATED",
        },
        include: { customer: true, payments: true },
      });
    }
    throw e;
  }
}

export async function getPendingBills() {
  return prisma.bill.findMany({
    where: {
      status: { in: ["GENERATED", "SENT", "PARTIALLY_PAID"] },
      // Hide bills belonging to archived (soft-deleted) customers.
      customer: { deletedAt: null },
    },
    include: { customer: true, payments: true },
    orderBy: { createdAt: "desc" },
  });
}

// Dashboard aggregation moved to dashboard.service.ts (getDashboardData),
// which computes revenue per-customer instead of with a single global price.

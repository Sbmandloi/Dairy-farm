import { prisma } from "@/lib/db";
import { getSettings } from "./settings.service";
import { generateInvoiceNumber } from "@/lib/utils/invoice-number";

export async function getBillsForPeriod(periodStart: Date, periodEnd: Date) {
  return prisma.bill.findMany({
    where: { periodStart, periodEnd },
    include: { customer: true, payments: true },
    orderBy: { customer: { name: "asc" } },
  });
}

export async function getCustomersWithBillsForPeriod(periodStart: Date, periodEnd: Date) {
  const customers = await prisma.customer.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });

  const bills = await prisma.bill.findMany({
    where: { periodStart, periodEnd },
    include: { payments: true },
  });

  const billMap = new Map(bills.map((b) => [b.customerId, b]));
  return customers.map((c) => ({ customer: c, bill: billMap.get(c.id) ?? null }));
}

export async function getBillById(id: string) {
  return prisma.bill.findUnique({
    where: { id },
    include: { customer: true, payments: true },
  });
}

export async function generateBillsForPeriod(
  periodStart: Date,
  periodEnd: Date,
  customerId?: string
) {
  const customers = customerId
    ? await prisma.customer.findMany({ where: { id: customerId, isActive: true } })
    : await prisma.customer.findMany({ where: { isActive: true } });

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
  });
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

export async function createManualBill(data: {
  customerId: string;
  periodStart: Date;
  periodEnd: Date;
  totalLiters: number;
  pricePerLiter: number;
  notes?: string;
}) {
  const totalAmount = Math.round(data.totalLiters * data.pricePerLiter * 100) / 100;
  const invoiceNumber = await generateInvoiceNumber(data.customerId, data.periodStart);

  return prisma.bill.create({
    data: {
      customerId: data.customerId,
      periodStart: data.periodStart,
      periodEnd: data.periodEnd,
      totalLiters: data.totalLiters,
      pricePerLiter: data.pricePerLiter,
      totalAmount,
      invoiceNumber,
      status: "GENERATED",
    },
    include: { customer: true, payments: true },
  });
}

export async function getPendingBills() {
  return prisma.bill.findMany({
    where: { status: { in: ["GENERATED", "SENT", "PARTIALLY_PAID"] } },
    include: { customer: true, payments: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getDashboardStats() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const [todayAgg, monthAgg, activeCustomers, pendingBills] = await Promise.all([
    prisma.dailyMilkEntry.aggregate({
      where: { date: today },
      _sum: { totalLiters: true },
    }),
    prisma.dailyMilkEntry.aggregate({
      where: { date: { gte: monthStart, lte: monthEnd } },
      _sum: { totalLiters: true },
    }),
    prisma.customer.count({ where: { isActive: true } }),
    prisma.bill.findMany({
      where: { status: { in: ["GENERATED", "SENT", "PARTIALLY_PAID"] } },
      select: { totalAmount: true, payments: { select: { amountPaid: true } } },
    }),
  ]);

  const settings = await getSettings();
  const price = parseFloat(String(settings.globalPricePerLiter));

  const todayLiters = parseFloat(String(todayAgg._sum.totalLiters ?? 0));
  const monthLiters = parseFloat(String(monthAgg._sum.totalLiters ?? 0));

  const pendingAmount = pendingBills.reduce((sum, b) => {
    const paid = b.payments.reduce((s, p) => s + parseFloat(String(p.amountPaid)), 0);
    return sum + (parseFloat(String(b.totalAmount)) - paid);
  }, 0);

  return {
    todayLiters,
    todayRevenue: todayLiters * price,
    monthLiters,
    monthRevenue: monthLiters * price,
    activeCustomers,
    pendingBills: pendingBills.length,
    pendingAmount,
  };
}

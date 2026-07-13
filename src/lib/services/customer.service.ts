import { prisma } from "@/lib/db";
import { formatE164 } from "@/lib/utils/phone";
import { decimalToNumber } from "@/lib/utils/format";
import {
  CreateCustomerInput,
  UpdateCustomerInput,
  CustomerPatch,
} from "@/lib/schemas/customer.schema";

export async function getCustomers(opts?: { active?: boolean; search?: string }) {
  return prisma.customer.findMany({
    where: {
      ...(opts?.active !== undefined && { isActive: opts.active }),
      ...(opts?.search && {
        OR: [
          { name: { contains: opts.search, mode: "insensitive" } },
          { phoneNumber: { contains: opts.search } },
        ],
      }),
    },
    orderBy: { name: "asc" },
  });
}

export async function getCustomersWithStats(opts?: { active?: boolean; search?: string }) {
  const customers = await prisma.customer.findMany({
    where: {
      ...(opts?.active !== undefined && { isActive: opts.active }),
      ...(opts?.search && {
        OR: [
          { name: { contains: opts.search, mode: "insensitive" } },
          { phoneNumber: { contains: opts.search } },
        ],
      }),
    },
    orderBy: { name: "asc" },
    include: {
      bills: {
        select: {
          totalAmount: true,
          totalLiters: true,
          payments: { select: { amountPaid: true } },
        },
      },
      dailyEntries: {
        select: { totalLiters: true },
      },
    },
  });

  return customers.map((c) => {
    const totalLiters = c.dailyEntries.reduce(
      (sum, e) => sum + parseFloat(String(e.totalLiters)),
      0
    );
    const totalBilled = c.bills.reduce(
      (sum, b) => sum + parseFloat(String(b.totalAmount)),
      0
    );
    const totalPaid = c.bills
      .flatMap((b) => b.payments)
      .reduce((sum, p) => sum + parseFloat(String(p.amountPaid)), 0);
    const { bills, dailyEntries, ...customerBase } = c;
    return {
      ...customerBase,
      stats: {
        totalLiters,
        deliveryDays: dailyEntries.length,
        totalBilled,
        totalPaid,
        balance: totalBilled - totalPaid,
      },
    };
  });
}

export type PaymentStanding = "NO_BILLS" | "PAID" | "PARTIAL" | "UNPAID";

export type ManagedCustomer = {
  id: string;
  name: string;
  phoneNumber: string | null;
  address: string | null;
  pricePerLiter: number | null;
  isActive: boolean;
  startDate: string; // "YYYY-MM-DD"
  lastRemindedAt: string | null; // ISO
  totalLiters: number;
  totalBilled: number;
  totalPaid: number;
  pendingAmount: number;
  unpaidBills: number;
  paymentStanding: PaymentStanding;
  /** Days since the end of the oldest bill that still has money owing. */
  daysOverdue: number | null;
  /** When money was last collected from them — "YYYY-MM-DD", or null if never. */
  lastPaymentOn: string | null;
  paymentsCount: number;
};

/**
 * Every customer (active AND inactive) with the payment picture needed to decide
 * who to chase: what's still owed, across how many bills, and how stale the
 * oldest one is. Fully serialized — no Decimal/Date instances cross to the client.
 */
export async function getCustomersForManager(): Promise<ManagedCustomer[]> {
  const customers = await prisma.customer.findMany({
    orderBy: { name: "asc" },
    include: {
      bills: {
        select: {
          totalAmount: true,
          periodEnd: true,
          payments: { select: { amountPaid: true, paidOn: true } },
        },
      },
      dailyEntries: { select: { totalLiters: true } },
    },
  });

  const today = new Date();

  return customers.map((c) => {
    const totalLiters = c.dailyEntries.reduce((s, e) => s + decimalToNumber(e.totalLiters), 0);

    let totalBilled = 0;
    let totalPaid = 0;
    let unpaidBills = 0;
    let oldestUnpaidEnd: Date | null = null;
    let paymentsCount = 0;
    let lastPaidOn: Date | null = null;

    for (const bill of c.bills) {
      const amount = decimalToNumber(bill.totalAmount);
      const paid = bill.payments.reduce((s, p) => s + decimalToNumber(p.amountPaid), 0);
      totalBilled += amount;
      totalPaid += paid;

      paymentsCount += bill.payments.length;
      for (const p of bill.payments) {
        if (!lastPaidOn || p.paidOn > lastPaidOn) lastPaidOn = p.paidOn;
      }

      // Sub-rupee remainders are rounding noise, not a real debt.
      if (amount - paid > 0.01) {
        unpaidBills++;
        if (!oldestUnpaidEnd || bill.periodEnd < oldestUnpaidEnd) oldestUnpaidEnd = bill.periodEnd;
      }
    }

    const pendingAmount = totalBilled - totalPaid;

    let paymentStanding: PaymentStanding;
    if (c.bills.length === 0) paymentStanding = "NO_BILLS";
    else if (pendingAmount <= 0.01) paymentStanding = "PAID";
    else if (totalPaid > 0) paymentStanding = "PARTIAL";
    else paymentStanding = "UNPAID";

    const daysOverdue = oldestUnpaidEnd
      ? Math.max(0, Math.floor((today.getTime() - oldestUnpaidEnd.getTime()) / 86_400_000))
      : null;

    return {
      id: c.id,
      name: c.name,
      phoneNumber: c.phoneNumber,
      address: c.address,
      pricePerLiter: c.pricePerLiter === null ? null : decimalToNumber(c.pricePerLiter),
      isActive: c.isActive,
      startDate: c.startDate.toISOString().slice(0, 10),
      lastRemindedAt: c.lastRemindedAt ? c.lastRemindedAt.toISOString() : null,
      totalLiters,
      totalBilled,
      totalPaid,
      pendingAmount: Math.max(0, pendingAmount),
      unpaidBills,
      paymentStanding,
      daysOverdue,
      lastPaymentOn: lastPaidOn ? lastPaidOn.toISOString().slice(0, 10) : null,
      paymentsCount,
    };
  });
}

/**
 * Apply a batch of edits made in the customer manager. Runs in a transaction so a
 * bad row can't leave the batch half-applied.
 */
export async function bulkUpdateCustomers(patches: CustomerPatch[]) {
  return prisma.$transaction(
    patches.map((p) =>
      prisma.customer.update({
        where: { id: p.id },
        data: {
          ...(p.name !== undefined && { name: p.name }),
          ...(p.phoneNumber !== undefined && {
            phoneNumber: p.phoneNumber ? formatE164(p.phoneNumber) : null,
          }),
          ...(p.address !== undefined && { address: p.address || null }),
          ...(p.pricePerLiter !== undefined && { pricePerLiter: p.pricePerLiter }),
          ...(p.isActive !== undefined && { isActive: p.isActive }),
        },
      })
    )
  );
}

export async function getCustomerById(id: string) {
  return prisma.customer.findUnique({
    where: { id },
    include: {
      bills: { orderBy: { periodStart: "desc" }, take: 12, include: { payments: true } },
      dailyEntries: { orderBy: { date: "desc" }, take: 30 },
    },
  });
}

/**
 * Full payment ledger for a customer: every payment ever recorded against any of
 * their bills, newest first, with the parent bill so we can show what it settled.
 * Also returns account-wide totals (across ALL bills, not just the recent page).
 */
export async function getCustomerPaymentHistory(customerId: string) {
  const [bills, billedAgg] = await Promise.all([
    prisma.bill.findMany({
      where: { customerId },
      orderBy: { periodStart: "desc" },
      include: { payments: { orderBy: [{ paidOn: "desc" }, { createdAt: "desc" }] } },
    }),
    prisma.bill.aggregate({
      where: { customerId },
      _sum: { totalAmount: true },
    }),
  ]);

  const payments = bills
    .flatMap((bill) =>
      bill.payments.map((p) => ({
        id: p.id,
        amountPaid: decimalToNumber(p.amountPaid),
        paidOn: p.paidOn,
        note: p.note,
        bill: {
          id: bill.id,
          invoiceNumber: bill.invoiceNumber,
          status: bill.status,
          periodStart: bill.periodStart,
          periodEnd: bill.periodEnd,
          totalAmount: decimalToNumber(bill.totalAmount),
        },
      }))
    )
    .sort((a, b) => b.paidOn.getTime() - a.paidOn.getTime());

  const totalBilled = decimalToNumber(billedAgg._sum.totalAmount ?? 0);
  const totalPaid = payments.reduce((s, p) => s + p.amountPaid, 0);

  /** Per-bill outstanding, so a payment row can show what was still pending on that bill. */
  const pendingByBill = new Map(
    bills.map((bill) => {
      const paid = bill.payments.reduce((s, p) => s + decimalToNumber(p.amountPaid), 0);
      return [bill.id, decimalToNumber(bill.totalAmount) - paid];
    })
  );

  return {
    payments,
    pendingByBill,
    totalBilled,
    totalPaid,
    totalPending: totalBilled - totalPaid,
    unpaidBills: bills.filter((b) => (pendingByBill.get(b.id) ?? 0) > 0.001).length,
  };
}

export async function createCustomer(data: CreateCustomerInput) {
  return prisma.customer.create({
    data: {
      name: data.name,
      phoneNumber: data.phoneNumber ? formatE164(data.phoneNumber) : null,
      address: data.address,
      pricePerLiter: data.pricePerLiter,
      startDate: new Date(data.startDate),
    },
  });
}

export async function updateCustomer(id: string, data: UpdateCustomerInput) {
  return prisma.customer.update({
    where: { id },
    data: {
      ...(data.name && { name: data.name }),
      ...(data.phoneNumber !== undefined && {
        phoneNumber: data.phoneNumber ? formatE164(data.phoneNumber) : null,
      }),
      ...(data.address !== undefined && { address: data.address }),
      ...(data.pricePerLiter !== undefined && { pricePerLiter: data.pricePerLiter }),
      ...(data.startDate && { startDate: new Date(data.startDate) }),
    },
  });
}

export async function toggleCustomerStatus(id: string) {
  const customer = await prisma.customer.findUniqueOrThrow({ where: { id } });
  return prisma.customer.update({
    where: { id },
    data: { isActive: !customer.isActive },
  });
}

export async function deleteCustomer(id: string) {
  // Delete all related records first (cascade)
  await prisma.payment.deleteMany({ where: { bill: { customerId: id } } });
  await prisma.bill.deleteMany({ where: { customerId: id } });
  await prisma.dailyMilkEntry.deleteMany({ where: { customerId: id } });
  return prisma.customer.delete({ where: { id } });
}

import { prisma } from "@/lib/db";
import { formatE164 } from "@/lib/utils/phone";
import { CreateCustomerInput, UpdateCustomerInput } from "@/lib/schemas/customer.schema";

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

export async function getCustomerById(id: string) {
  return prisma.customer.findUnique({
    where: { id },
    include: {
      bills: { orderBy: { periodStart: "desc" }, take: 12, include: { payments: true } },
      dailyEntries: { orderBy: { date: "desc" }, take: 30 },
    },
  });
}

export async function createCustomer(data: CreateCustomerInput) {
  return prisma.customer.create({
    data: {
      name: data.name,
      phoneNumber: formatE164(data.phoneNumber),
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
      ...(data.phoneNumber && { phoneNumber: formatE164(data.phoneNumber) }),
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

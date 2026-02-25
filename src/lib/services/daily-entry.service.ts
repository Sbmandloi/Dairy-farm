import { prisma } from "@/lib/db";
import { DailyEntryItemInput } from "@/lib/schemas/daily-entry.schema";

export async function getDailyEntries(date: Date) {
  return prisma.dailyMilkEntry.findMany({
    where: { date },
    include: { customer: true },
    orderBy: { customer: { name: "asc" } },
  });
}

export async function getDailyEntriesWithCustomers(date: Date) {
  const activeCustomers = await prisma.customer.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });

  const entries = await prisma.dailyMilkEntry.findMany({
    where: { date },
  });

  const entryMap = new Map(entries.map((e) => [e.customerId, e]));

  return activeCustomers.map((customer) => ({
    customer,
    entry: entryMap.get(customer.id) ?? null,
  }));
}

export async function saveDailyEntries(date: Date, entries: DailyEntryItemInput[]) {
  return prisma.$transaction(async (tx) => {
    const results = [];
    for (const entry of entries) {
      if (entry.totalLiters === 0 && !entry.morningLiters && !entry.eveningLiters) {
        // Delete entry if all zeros
        await tx.dailyMilkEntry.deleteMany({
          where: { customerId: entry.customerId, date },
        });
        continue;
      }
      const result = await tx.dailyMilkEntry.upsert({
        where: { customerId_date: { customerId: entry.customerId, date } },
        create: {
          customerId: entry.customerId,
          date,
          morningLiters: entry.morningLiters,
          eveningLiters: entry.eveningLiters,
          totalLiters: entry.totalLiters,
          notes: entry.notes,
        },
        update: {
          morningLiters: entry.morningLiters,
          eveningLiters: entry.eveningLiters,
          totalLiters: entry.totalLiters,
          notes: entry.notes,
        },
      });
      results.push(result);
    }
    return results;
  });
}

export async function copyPreviousDay(targetDate: Date) {
  const prevDate = new Date(targetDate);
  prevDate.setDate(prevDate.getDate() - 1);

  return prisma.dailyMilkEntry.findMany({
    where: { date: prevDate },
    include: { customer: true },
  });
}

export async function getDailySummary(date: Date) {
  const result = await prisma.dailyMilkEntry.aggregate({
    where: { date },
    _sum: { totalLiters: true },
    _count: true,
  });
  return {
    totalLiters: parseFloat(String(result._sum.totalLiters ?? 0)),
    customerCount: result._count,
  };
}

export async function getEntriesForPeriod(customerId: string, start: Date, end: Date) {
  return prisma.dailyMilkEntry.findMany({
    where: { customerId, date: { gte: start, lte: end } },
    orderBy: { date: "asc" },
  });
}

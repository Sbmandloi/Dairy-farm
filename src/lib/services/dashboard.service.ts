import { prisma } from "@/lib/db";
import { getSettings } from "./settings.service";
import { getPendingBills } from "./billing.service";
import { decimalToNumber } from "@/lib/utils/format";
import { todayInAppTz, parseDateOnly } from "@/lib/utils/date";

/**
 * Single source of truth for the dashboard. Fetches everything the page needs
 * in ONE parallel batch (5 queries total, down from 8) and computes all derived
 * numbers here so the page stays purely presentational.
 *
 * Revenue is computed PER CUSTOMER using each customer's effective price
 * (their custom pricePerLiter, else the global price) so the dashboard's
 * "est. revenue" matches what bill generation actually produces.
 */
export async function getDashboardData() {
  // "Today" is the dairy's day (Asia/Kolkata), not the server's local day, and is
  // anchored the same way entries are written/queried — so "Today's Milk" matches
  // what Daily Entry saved regardless of where the server runs.
  const todayStr = todayInAppTz();
  const today = parseDateOnly(todayStr);
  const [year, month] = todayStr.split("-").map(Number);

  // Half-open month range on UTC-midnight bounds. Range bounds must NOT use the
  // noon anchor: `date >= <1st at noon>` would exclude the 1st.
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const nextMonthStart = new Date(Date.UTC(year, month, 1));

  const [activeCustomers, todayEntries, monthGroups, pendingBills, settings] =
    await Promise.all([
      prisma.customer.findMany({
        where: { isActive: true, deletedAt: null },
        orderBy: { name: "asc" },
      }),
      // Exclude archived (soft-deleted) customers' entries from live totals.
      prisma.dailyMilkEntry.findMany({
        where: { date: today, customer: { deletedAt: null } },
      }),
      prisma.dailyMilkEntry.groupBy({
        by: ["customerId"],
        where: {
          date: { gte: monthStart, lt: nextMonthStart },
          customer: { deletedAt: null },
        },
        _sum: { totalLiters: true },
      }),
      getPendingBills(),
      getSettings(),
    ]);

  const globalPrice = decimalToNumber(settings.globalPricePerLiter);
  // Effective price per active customer (custom price, else global).
  const priceMap = new Map(
    activeCustomers.map((c) => [
      c.id,
      c.pricePerLiter != null ? decimalToNumber(c.pricePerLiter) : globalPrice,
    ])
  );
  const priceOf = (customerId: string) => priceMap.get(customerId) ?? globalPrice;

  // Today's list: every active customer with their entry (or null).
  const entryMap = new Map(todayEntries.map((e) => [e.customerId, e]));
  const todayList = activeCustomers.map((customer) => ({
    customer,
    entry: entryMap.get(customer.id) ?? null,
  }));

  let todayLiters = 0;
  let todayRevenue = 0;
  for (const e of todayEntries) {
    const liters = decimalToNumber(e.totalLiters);
    todayLiters += liters;
    todayRevenue += liters * priceOf(e.customerId);
  }

  let monthLiters = 0;
  let monthRevenue = 0;
  for (const g of monthGroups) {
    const liters = decimalToNumber(g._sum.totalLiters);
    monthLiters += liters;
    monthRevenue += liters * priceOf(g.customerId);
  }

  const pendingAmount = pendingBills.reduce((sum, b) => {
    const paid = b.payments.reduce((s, p) => s + decimalToNumber(p.amountPaid), 0);
    return sum + (decimalToNumber(b.totalAmount) - paid);
  }, 0);

  return {
    today,
    stats: {
      todayLiters,
      todayRevenue,
      monthLiters,
      monthRevenue,
      activeCustomers: activeCustomers.length,
      pendingBills: pendingBills.length,
      pendingAmount,
    },
    todayList,
    pendingBills,
  };
}

import { getDashboardData } from "@/lib/services/dashboard.service";
import { withAuth } from "@/lib/mobile/guard";
import { ok } from "@/lib/mobile/response";
import { dateOnly, toBillDTO, toCustomerDTO, toDailyEntryDTO } from "@/lib/mobile/dto";

export const dynamic = "force-dynamic";

/**
 * GET /api/mobile/dashboard
 *
 * Delegates entirely to `getDashboardData()` — the same single source of truth
 * the web dashboard renders from, including its per-customer revenue rule and
 * its Asia/Kolkata definition of "today". Nothing is recomputed here.
 */
export const GET = withAuth(async () => {
  const { today, stats, todayList, pendingBills } = await getDashboardData();

  return ok({
    today: dateOnly(today),
    stats,
    todayList: todayList.map(({ customer, entry }) => ({
      customer: toCustomerDTO(customer),
      entry: entry ? toDailyEntryDTO(entry) : null,
    })),
    pendingBills: pendingBills.map((bill) => ({
      ...toBillDTO(bill),
      customer: toCustomerDTO(bill.customer),
    })),
  });
});

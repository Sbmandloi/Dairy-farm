import { saveDailyEntriesSchema } from "@/lib/schemas/daily-entry.schema";
import {
  copyPreviousDay,
  getDailyEntriesWithCustomers,
  saveDailyEntries,
} from "@/lib/services/daily-entry.service";
import { getSettings } from "@/lib/services/settings.service";
import { decimalToNumber } from "@/lib/utils/format";
import { parseDateOnly, todayInAppTz } from "@/lib/utils/date";
import { withAuth } from "@/lib/mobile/guard";
import { fail, failFrom, ok } from "@/lib/mobile/response";
import { toCustomerDTO, toDailyEntryDTO } from "@/lib/mobile/dto";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /api/mobile/daily-entry?date=YYYY-MM-DD[&copyPrevious=1]
 *
 * The day's rows (every active customer, with their entry or null), the entry
 * mode, and the same summary the web page computes — totals derived with each
 * customer's effective price so "est. revenue" agrees with what bills produce.
 *
 * `copyPrevious=1` instead returns yesterday's quantities for pre-filling,
 * without writing anything.
 */
export const GET = withAuth(async (req) => {
  const sp = req.nextUrl.searchParams;
  const dateStr = sp.get("date") || todayInAppTz();
  if (!DATE_RE.test(dateStr)) return fail("date must be YYYY-MM-DD");

  const date = parseDateOnly(dateStr);

  if (sp.get("copyPrevious") === "1") {
    const previous = await copyPreviousDay(date);
    return ok(
      previous.map((e) => ({
        customerId: e.customerId,
        morningLiters: e.morningLiters === null ? null : decimalToNumber(e.morningLiters),
        eveningLiters: e.eveningLiters === null ? null : decimalToNumber(e.eveningLiters),
        totalLiters: decimalToNumber(e.totalLiters),
      }))
    );
  }

  const [rows, settings] = await Promise.all([
    getDailyEntriesWithCustomers(date),
    getSettings(),
  ]);

  const globalPrice = decimalToNumber(settings.globalPricePerLiter);

  let totalLiters = 0;
  let estimatedRevenue = 0;
  let customerCount = 0;
  for (const { customer, entry } of rows) {
    if (!entry) continue;
    const liters = decimalToNumber(entry.totalLiters);
    if (liters <= 0) continue;
    customerCount++;
    totalLiters += liters;
    const price =
      customer.pricePerLiter !== null ? decimalToNumber(customer.pricePerLiter) : globalPrice;
    estimatedRevenue += liters * price;
  }

  return ok({
    date: dateStr,
    entryMode: settings.entryMode,
    globalPricePerLiter: globalPrice,
    summary: { totalLiters, estimatedRevenue, customerCount },
    rows: rows.map(({ customer, entry }) => ({
      customer: toCustomerDTO(customer),
      entry: entry ? toDailyEntryDTO(entry) : null,
    })),
  });
});

/**
 * POST /api/mobile/daily-entry { date, entries }
 *
 * Bulk save for one day. Delegates to `saveDailyEntries`, which keeps the
 * "all zeros deletes the row" rule and the explicit null-coalescing that makes
 * clearing just the morning or just the evening actually stick.
 */
export const POST = withAuth(async (req) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid request body");
  }

  const parsed = saveDailyEntriesSchema.safeParse(body);
  if (!parsed.success) {
    return fail("Validation failed", 422, parsed.error.flatten().fieldErrors as Record<string, string[]>);
  }

  try {
    await saveDailyEntries(parseDateOnly(parsed.data.date), parsed.data.entries);
    return ok({ saved: parsed.data.entries.length });
  } catch (error) {
    return failFrom(error, "Failed to save entries");
  }
});

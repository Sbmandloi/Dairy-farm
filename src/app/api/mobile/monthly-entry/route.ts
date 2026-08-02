import { z } from "zod";
import { getMonthlyEntries, saveDailyEntries } from "@/lib/services/daily-entry.service";
import { getSettings } from "@/lib/services/settings.service";
import { decimalToNumber } from "@/lib/utils/format";
import { currentYearMonth, parseDateOnly } from "@/lib/utils/date";
import { withAuth } from "@/lib/mobile/guard";
import { fail, failFrom, ok } from "@/lib/mobile/response";
import { dateOnly } from "@/lib/mobile/dto";

export const dynamic = "force-dynamic";

/**
 * GET /api/mobile/monthly-entry?year=&month=
 *
 * The whole month as a customer × day matrix source: the active customers, every
 * entry in the month, and how many days it has.
 */
export const GET = withAuth(async (req) => {
  const sp = req.nextUrl.searchParams;
  const now = currentYearMonth();
  const year = Number(sp.get("year")) || now.year;
  const month = Number(sp.get("month")) || now.month;

  if (month < 1 || month > 12) return fail("month must be between 1 and 12");

  const [{ customers, entries, daysInMonth }, settings] = await Promise.all([
    getMonthlyEntries(year, month),
    getSettings(),
  ]);

  return ok({
    year,
    month,
    daysInMonth,
    entryMode: settings.entryMode,
    customers: customers.map((c) => ({
      id: c.id,
      name: c.name,
      phoneNumber: c.phoneNumber,
    })),
    entries: entries.map((e) => ({
      id: e.id,
      customerId: e.customerId,
      date: dateOnly(e.date),
      morningLiters: e.morningLiters === null ? null : decimalToNumber(e.morningLiters),
      eveningLiters: e.eveningLiters === null ? null : decimalToNumber(e.eveningLiters),
      totalLiters: decimalToNumber(e.totalLiters),
    })),
  });
});

const changeSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  customerId: z.string().cuid(),
  totalLiters: z.number().min(0),
  morningLiters: z.number().min(0).nullable().optional(),
  eveningLiters: z.number().min(0).nullable().optional(),
});

/**
 * POST /api/mobile/monthly-entry { changes }
 *
 * Saves edits made anywhere in the grid. Changes are grouped by date and sent
 * through the same `saveDailyEntries` path as the daily screen — one write path
 * for milk quantities, so both screens observe identical rules.
 */
export const POST = withAuth(async (req) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid request body");
  }

  const parsed = z.object({ changes: z.array(changeSchema) }).safeParse(body);
  if (!parsed.success) {
    return fail("Validation failed", 422, parsed.error.flatten().fieldErrors as Record<string, string[]>);
  }

  const byDate = new Map<string, typeof parsed.data.changes>();
  for (const change of parsed.data.changes) {
    const bucket = byDate.get(change.date);
    if (bucket) bucket.push(change);
    else byDate.set(change.date, [change]);
  }

  try {
    for (const [dateStr, dateEntries] of byDate) {
      await saveDailyEntries(
        parseDateOnly(dateStr),
        dateEntries.map((e) => ({
          customerId: e.customerId,
          morningLiters: e.morningLiters ?? undefined,
          eveningLiters: e.eveningLiters ?? undefined,
          totalLiters: e.totalLiters,
        }))
      );
    }
    return ok({ saved: parsed.data.changes.length });
  } catch (error) {
    return failFrom(error, "Failed to save entries");
  }
});

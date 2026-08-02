import { z } from "zod";
import {
  generateBillsForPeriod,
  getCustomersWithBillsForPeriod,
} from "@/lib/services/billing.service";
import { decimalToNumber } from "@/lib/utils/format";
import { currentYearMonth, monthPeriod, parseDateOnly } from "@/lib/utils/date";
import { withAuth } from "@/lib/mobile/guard";
import { fail, failFrom, ok } from "@/lib/mobile/response";
import { toBillDTO, toCustomerDTO } from "@/lib/mobile/dto";

export const dynamic = "force-dynamic";

/**
 * GET /api/mobile/billing?year=&month=
 *
 * Every active customer for the month with their bill (or null), plus the same
 * four summary figures the web page shows. The period is always a whole month —
 * derived through `monthPeriod`, the single place that rule lives.
 */
export const GET = withAuth(async (req) => {
  const sp = req.nextUrl.searchParams;
  const now = currentYearMonth();
  const year = Number(sp.get("year")) || now.year;
  const month = Number(sp.get("month")) || now.month;
  if (month < 1 || month > 12) return fail("month must be between 1 and 12");

  const { start, end } = monthPeriod(year, month);
  const rows = await getCustomersWithBillsForPeriod(parseDateOnly(start), parseDateOnly(end));

  const billed = rows.filter((r) => r.bill !== null);
  const totalAmount = billed.reduce((s, r) => s + decimalToNumber(r.bill!.totalAmount), 0);
  const totalLiters = billed.reduce((s, r) => s + decimalToNumber(r.bill!.totalLiters), 0);
  const totalPaid = billed.reduce(
    (s, r) => s + r.bill!.payments.reduce((ps, p) => ps + decimalToNumber(p.amountPaid), 0),
    0
  );

  return ok({
    year,
    month,
    periodStart: start,
    periodEnd: end,
    summary: {
      totalLiters,
      totalAmount,
      totalPaid,
      outstanding: totalAmount - totalPaid,
      billCount: billed.length,
      customerCount: rows.length,
      withoutBill: rows.length - billed.length,
      // How many could actually be sent: has a phone number and still owes.
      sendableCount: billed.filter((r) => r.customer.phoneNumber && r.bill!.status !== "PAID")
        .length,
    },
    rows: rows.map(({ customer, bill }) => ({
      customer: toCustomerDTO(customer),
      bill: bill ? toBillDTO(bill) : null,
    })),
  });
});

const generateSchema = z.object({
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  customerId: z.string().cuid().optional(),
});

/**
 * POST /api/mobile/billing — generate (upsert) bills for a period.
 *
 * Omitting `customerId` runs the whole month for every active customer, exactly
 * like the web "Generate Bills" button; passing one bills a single customer.
 * Months with no milk entries produce no bill, as on the web.
 */
export const POST = withAuth(async (req) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid request body");
  }

  const parsed = generateSchema.safeParse(body);
  if (!parsed.success) return fail("Invalid period", 422);

  try {
    const bills = await generateBillsForPeriod(
      parseDateOnly(parsed.data.periodStart),
      parseDateOnly(parsed.data.periodEnd),
      parsed.data.customerId
    );
    return ok(
      bills.map((b) => ({
        id: b.id,
        customerId: b.customerId,
        invoiceNumber: b.invoiceNumber,
        totalLiters: decimalToNumber(b.totalLiters),
        pricePerLiter: decimalToNumber(b.pricePerLiter),
        totalAmount: decimalToNumber(b.totalAmount),
        status: b.status,
        periodStart: b.periodStart.toISOString().slice(0, 10),
        periodEnd: b.periodEnd.toISOString().slice(0, 10),
      }))
    );
  } catch (error) {
    return failFrom(error, "Failed to generate bills");
  }
});

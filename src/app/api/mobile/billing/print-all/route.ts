import { NextResponse } from "next/server";
import { getBillsForPeriod } from "@/lib/services/billing.service";
import { generateBillsBatchPdfBuffer } from "@/lib/services/pdf.service";
import { monthPeriod, parseDateOnly } from "@/lib/utils/date";
import { withAuth } from "@/lib/mobile/guard";
import { fail, notFound } from "@/lib/mobile/response";
import { BillWithCustomer } from "@/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/mobile/billing/print-all?year=&month=
 *
 * The whole month as one PDF, a bill per page — so it can be shared to a
 * printer or WhatsApp in a single action from the phone, matching the web
 * "Print All" button. Archived customers are excluded by `getBillsForPeriod`.
 */
export const GET = withAuth(async (req) => {
  const sp = req.nextUrl.searchParams;
  const year = Number(sp.get("year"));
  const month = Number(sp.get("month"));
  if (!year || !month || month < 1 || month > 12) return fail("Invalid year/month");

  const { start, end } = monthPeriod(year, month);
  const bills = await getBillsForPeriod(parseDateOnly(start), parseDateOnly(end));
  if (bills.length === 0) return notFound("No bills generated for this month yet.");

  const buffer = await generateBillsBatchPdfBuffer(bills as BillWithCustomer[]);
  const filename = `bills-${year}-${String(month).padStart(2, "0")}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(buffer.length),
      "Cache-Control": "no-store",
    },
  });
});

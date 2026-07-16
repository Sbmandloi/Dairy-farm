import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getBillsForPeriod } from "@/lib/services/billing.service";
import { generateBillsBatchPdfBuffer } from "@/lib/services/pdf.service";
import { monthPeriod, parseDateOnly } from "@/lib/utils/date";
import { BillWithCustomer } from "@/types";

/**
 * GET /api/billing/print-all?year=YYYY&month=M[&inline=1]
 *
 * Every bill for the month in ONE PDF (a bill per page), so the whole month can
 * be printed in a single job or saved to disk as one file. Archived customers'
 * bills are excluded (getBillsForPeriod filters them).
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const year = Number(req.nextUrl.searchParams.get("year"));
  const month = Number(req.nextUrl.searchParams.get("month"));
  if (!year || !month || month < 1 || month > 12) {
    return NextResponse.json({ error: "Invalid year/month" }, { status: 400 });
  }

  const { start, end } = monthPeriod(year, month);
  const bills = await getBillsForPeriod(parseDateOnly(start), parseDateOnly(end));

  if (bills.length === 0) {
    return NextResponse.json(
      { error: "No bills generated for this month yet." },
      { status: 404 }
    );
  }

  try {
    const buffer = await generateBillsBatchPdfBuffer(bills as BillWithCustomer[]);
    const inline = req.nextUrl.searchParams.get("inline") === "1";
    const filename = `bills-${year}-${String(month).padStart(2, "0")}.pdf`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${filename}"`,
        "Content-Length": String(buffer.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Batch PDF generation error:", error);
    return NextResponse.json({ error: "Failed to generate bills PDF" }, { status: 500 });
  }
}

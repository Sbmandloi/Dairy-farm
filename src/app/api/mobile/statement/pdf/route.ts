import { NextResponse } from "next/server";
import { buildCustomerStatement } from "@/lib/services/statement.service";
import { generateStatementPdfBuffer } from "@/lib/services/pdf.service";
import { withAuth } from "@/lib/mobile/guard";
import { fail, failFrom, notFound } from "@/lib/mobile/response";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * GET /api/mobile/statement/pdf?customerId=..&months=2026-05,2026-06[&notes=..]
 *
 * The consolidated multi-month bill as a PDF, for saving or printing from the
 * phone. Built through `buildCustomerStatement`, so the numbers always agree
 * with the Billing screen and the same monthly bills are upserted.
 */
export const GET = withAuth(async (req) => {
  const sp = req.nextUrl.searchParams;
  const customerId = sp.get("customerId");
  const months = (sp.get("months") ?? "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);

  if (!customerId) return fail("customerId is required");
  if (months.length === 0) return fail("Select at least one month.");

  try {
    const statement = await buildCustomerStatement(customerId, months, sp.get("notes"));
    if (statement.months.length === 0) {
      return notFound("No milk entries in the selected month(s), so there is nothing to bill.");
    }

    const buffer = await generateStatementPdfBuffer(statement);
    const safeName = statement.customer.name.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase();
    const filename = `bill-${safeName}-${months[0]}_to_${months[months.length - 1]}.pdf`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(buffer.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return failFrom(error, "Failed to build the bill", 500);
  }
});

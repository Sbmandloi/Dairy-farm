import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildCustomerStatement } from "@/lib/services/statement.service";
import { generateStatementPdfBuffer } from "@/lib/services/pdf.service";

/**
 * GET /api/billing/statement?customerId=..&months=2026-05,2026-06&notes=..[&inline=1]
 *
 * Consolidated multi-month bill for one customer: a summary line per selected
 * month plus overall total / paid / pending. Serves both the in-app preview
 * (inline=1) and the "print / save" download.
 *
 * Building the statement generates the underlying monthly bills, so the numbers
 * here always match the Billing page.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const customerId = sp.get("customerId");
  const months = (sp.get("months") ?? "").split(",").map((m) => m.trim()).filter(Boolean);
  const notes = sp.get("notes");

  if (!customerId) {
    return NextResponse.json({ error: "customerId is required" }, { status: 400 });
  }
  if (months.length === 0) {
    return NextResponse.json({ error: "Select at least one month." }, { status: 400 });
  }

  try {
    const statement = await buildCustomerStatement(customerId, months, notes);

    if (statement.months.length === 0) {
      return NextResponse.json(
        { error: "No milk entries in the selected month(s), so there is nothing to bill." },
        { status: 404 }
      );
    }

    const buffer = await generateStatementPdfBuffer(statement);
    const inline = sp.get("inline") === "1";
    const safeName = statement.customer.name.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase();
    const filename = `bill-${safeName}-${months[0]}_to_${months[months.length - 1]}.pdf`;

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
    const message = error instanceof Error ? error.message : "Failed to build the bill";
    console.error("Statement generation error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

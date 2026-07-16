import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getBillById } from "@/lib/services/billing.service";
import { generatePdfBuffer } from "@/lib/services/pdf.service";
import { BillWithCustomer } from "@/types";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const bill = await getBillById(id);

  if (!bill) {
    return NextResponse.json({ error: "Bill not found" }, { status: 404 });
  }

  try {
    const buffer = await generatePdfBuffer(bill as BillWithCustomer);
    const filename = `${bill.invoiceNumber}.pdf`;

    // ?inline=1 renders the bill in the preview dialog instead of downloading it,
    // so it can be checked before sending on WhatsApp.
    const inline = req.nextUrl.searchParams.get("inline") === "1";

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${filename}"`,
        "Content-Length": String(buffer.length),
        // Never cache: the bill reflects live payments/amounts.
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("PDF generation error:", error);
    return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 });
  }
}

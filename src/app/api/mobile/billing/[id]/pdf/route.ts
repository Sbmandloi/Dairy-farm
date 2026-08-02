import { NextResponse } from "next/server";
import { getBillById } from "@/lib/services/billing.service";
import { generatePdfBuffer } from "@/lib/services/pdf.service";
import { withAuth } from "@/lib/mobile/guard";
import { notFound } from "@/lib/mobile/response";
import { BillWithCustomer } from "@/types";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/mobile/billing/[id]/pdf
 *
 * The invoice PDF, byte-identical to the web download — the same
 * `generatePdfBuffer` and the same `@react-pdf/renderer` template, Devanagari
 * fonts included. The app saves this to its cache directory and opens it with
 * the device's PDF viewer, so previewing and printing are handled by Android
 * rather than reimplemented.
 *
 * This is the one family of mobile endpoints that does not use the JSON
 * envelope: the body is the PDF itself.
 */
export const GET = withAuth<Ctx>(async (_req, _session, { params }) => {
  const { id } = await params;
  const bill = await getBillById(id);
  if (!bill) return notFound("Bill not found");

  const buffer = await generatePdfBuffer(bill as BillWithCustomer);

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${bill.invoiceNumber}.pdf"`,
      "Content-Length": String(buffer.length),
      // Never cache: the bill reflects live payments and amounts.
      "Cache-Control": "no-store",
    },
  });
});

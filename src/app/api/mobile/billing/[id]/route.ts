import { z } from "zod";
import { getBillById, markBillPaid } from "@/lib/services/billing.service";
import { sendBillViaWhatsApp } from "@/lib/services/whatsapp.service";
import { withAuth } from "@/lib/mobile/guard";
import { fail, failFrom, notFound, ok } from "@/lib/mobile/response";
import { toBillDTO, toCustomerDTO, toPaymentDTO } from "@/lib/mobile/dto";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** GET — one bill with its customer and every payment against it. */
export const GET = withAuth<Ctx>(async (_req, _session, { params }) => {
  const { id } = await params;
  const bill = await getBillById(id);
  if (!bill) return notFound("Bill not found");

  return ok({
    ...toBillDTO(bill),
    customer: toCustomerDTO(bill.customer),
    payments: bill.payments.map(toPaymentDTO),
  });
});

const payloadSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("mark-paid"),
    amountPaid: z.number().positive("Amount must be positive"),
    paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    note: z.string().optional(),
  }),
  z.object({ action: z.literal("send-whatsapp") }),
]);

/**
 * POST /api/mobile/billing/[id] { action }
 *
 *   - "mark-paid"     — record a payment against this specific bill
 *   - "send-whatsapp" — send the PDF invoice and flip the bill to SENT
 *
 * Both go through the same services the web buttons use, so status transitions
 * and the "already partly paid shows only the balance" caption logic are shared.
 */
export const POST = withAuth<Ctx>(async (req, _session, { params }) => {
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid request body");
  }

  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return fail("Validation failed", 422, parsed.error.flatten().fieldErrors as Record<string, string[]>);
  }

  if (parsed.data.action === "mark-paid") {
    try {
      await markBillPaid(
        id,
        parsed.data.amountPaid,
        new Date(parsed.data.paidOn),
        parsed.data.note
      );
      return ok({ marked: true });
    } catch (error) {
      return failFrom(error, "Failed to mark as paid");
    }
  }

  try {
    const messageId = await sendBillViaWhatsApp(id);
    return ok({ messageId });
  } catch (error) {
    return failFrom(error, "Failed to send WhatsApp");
  }
});

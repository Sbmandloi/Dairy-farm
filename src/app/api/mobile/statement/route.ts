import { z } from "zod";
import { previewCustomerStatement } from "@/lib/services/statement.service";
import { sendStatementViaWhatsApp } from "@/lib/services/whatsapp.service";
import { withAuth } from "@/lib/mobile/guard";
import { fail, failFrom, ok } from "@/lib/mobile/response";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MONTH_RE = /^\d{4}-\d{2}$/;

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("preview"),
    customerId: z.string().cuid(),
    months: z.array(z.string().regex(MONTH_RE)).min(1, "Select at least one month."),
  }),
  z.object({
    action: z.literal("send"),
    customerId: z.string().cuid(),
    months: z.array(z.string().regex(MONTH_RE)).min(1, "Select at least one month."),
    notes: z.string().nullable().optional(),
  }),
]);

/**
 * POST /api/mobile/statement { action: "preview" | "send", ... }
 *
 * The Quick Bill flow. "preview" is strictly read-only — it computes the live
 * numbers from daily entries and the customer's rate so months can be explored
 * without creating anything. "send" builds the consolidated statement (which
 * upserts the underlying monthly bills through the ordinary billing path) and
 * delivers the PDF on WhatsApp with the Hindi caption.
 *
 * Months with no milk entries come back in `emptyMonths` rather than as ₹0
 * lines, exactly as on the web.
 */
export const POST = withAuth(async (req) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid request body");
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return fail("Validation failed", 422, parsed.error.flatten().fieldErrors as Record<string, string[]>);
  }

  if (parsed.data.action === "preview") {
    try {
      return ok(await previewCustomerStatement(parsed.data.customerId, parsed.data.months));
    } catch (error) {
      return failFrom(error, "Could not load the bill preview");
    }
  }

  try {
    const messageId = await sendStatementViaWhatsApp(
      parsed.data.customerId,
      parsed.data.months,
      parsed.data.notes
    );
    return ok({ messageId });
  } catch (error) {
    return failFrom(error, "Failed to send the bill");
  }
});

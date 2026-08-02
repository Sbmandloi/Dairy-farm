import { z } from "zod";
import { sendAllBillsWhatsApp } from "@/lib/services/whatsapp.service";
import { parseDateOnly } from "@/lib/utils/date";
import { withAuth } from "@/lib/mobile/guard";
import { fail, failFrom, ok } from "@/lib/mobile/response";

export const dynamic = "force-dynamic";
// Sending a month of invoices is many sequential Green API calls; give it room
// rather than letting the platform cut the run off half way through.
export const maxDuration = 300;

const schema = z.object({
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/**
 * POST /api/mobile/billing/send-all { periodStart, periodEnd }
 *
 * Bulk WhatsApp send for a month. Returns a per-customer outcome list rather
 * than a single pass/fail, because the service deliberately keeps going when one
 * number is bad — the app shows exactly who failed and why, as the web does.
 */
export const POST = withAuth(async (req) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid request body");
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return fail("Invalid period", 422);

  try {
    const results = await sendAllBillsWhatsApp(
      parseDateOnly(parsed.data.periodStart),
      parseDateOnly(parsed.data.periodEnd)
    );
    return ok({
      results,
      sent: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
    });
  } catch (error) {
    return failFrom(error, "Failed to send bills");
  }
});

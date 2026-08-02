import { recordCollectionSchema } from "@/lib/schemas/payment.schema";
import { recordCollection } from "@/lib/services/payment.service";
import { withAuth } from "@/lib/mobile/guard";
import { fail, failFrom, ok } from "@/lib/mobile/response";

export const dynamic = "force-dynamic";

/**
 * POST /api/mobile/payments { customerId, amount, paidOn, note? }
 *
 * Records cash collected from a customer. All of the allocation logic — settle
 * oldest bill first, split across bills into one Payment row each, reject an
 * amount above what is outstanding, re-derive every touched bill's status —
 * lives in `recordCollection` and is used verbatim.
 *
 * The response carries the allocation breakdown so the app can show the same
 * "₹500 settled INV-2026-05-003 and part of INV-2026-06-004" confirmation the
 * web dialog shows.
 */
export const POST = withAuth(async (req) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid request body");
  }

  const parsed = recordCollectionSchema.safeParse(body);
  if (!parsed.success) {
    return fail("Validation failed", 422, parsed.error.flatten().fieldErrors as Record<string, string[]>);
  }

  try {
    return ok(await recordCollection(parsed.data));
  } catch (error) {
    // Business refusals ("more than the ₹420.00 outstanding") reach the user
    // verbatim — they tell the farmer exactly what to type instead.
    return failFrom(error, "Failed to record collection");
  }
});

import { updateCollectionSchema } from "@/lib/schemas/payment.schema";
import { deleteCollection, updateCollection } from "@/lib/services/payment.service";
import { withAuth } from "@/lib/mobile/guard";
import { fail, failFrom, ok } from "@/lib/mobile/response";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/mobile/payments/[id] — correct a payment that was logged wrong.
 *
 * `updateCollection` rejects an amount that would push its bill past its total
 * and re-derives the bill's status afterwards, so a corrected typo can never
 * leave a bill stuck on PAID.
 */
export const PATCH = withAuth<Ctx>(async (req, _session, { params }) => {
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return fail("Invalid request body");
  }

  const parsed = updateCollectionSchema.safeParse({ ...body, paymentId: id });
  if (!parsed.success) {
    return fail("Validation failed", 422, parsed.error.flatten().fieldErrors as Record<string, string[]>);
  }

  try {
    await updateCollection(parsed.data);
    return ok({ updated: true });
  } catch (error) {
    return failFrom(error, "Failed to update payment");
  }
});

/** DELETE — remove a payment logged in error and put its bill back where it belongs. */
export const DELETE = withAuth<Ctx>(async (_req, _session, { params }) => {
  const { id } = await params;
  try {
    await deleteCollection(id);
    return ok({ deleted: true });
  } catch (error) {
    return failFrom(error, "Failed to delete payment");
  }
});

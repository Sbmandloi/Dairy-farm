import { bulkUpdateCustomersSchema, CustomerPatchInput } from "@/lib/schemas/customer.schema";
import { bulkUpdateCustomers, getCustomersForManager } from "@/lib/services/customer.service";
import { getCollectionsByCustomer } from "@/lib/services/payment.service";
import { getSettings } from "@/lib/services/settings.service";
import { decimalToNumber } from "@/lib/utils/format";
import { withAuth } from "@/lib/mobile/guard";
import { fail, failFrom, ok } from "@/lib/mobile/response";

export const dynamic = "force-dynamic";

/**
 * GET /api/mobile/customer-manager
 *
 * Everything the manager screen needs in one round trip — the same three calls
 * the web page makes. Both services already return fully serialized data (no
 * Decimal, no Date), so nothing is re-mapped here.
 */
export const GET = withAuth(async () => {
  const [customers, collections, settings] = await Promise.all([
    getCustomersForManager(),
    getCollectionsByCustomer(),
    getSettings(),
  ]);

  return ok({
    customers,
    collections,
    globalPricePerLiter: decimalToNumber(settings.globalPricePerLiter),
  });
});

/**
 * PATCH /api/mobile/customer-manager — commit a batch of staged row edits.
 *
 * Validates the whole batch up front and rejects all of it if any row is bad,
 * exactly as `bulkUpdateCustomersAction` does, so a user can never end up with
 * a half-applied save. Field errors come back keyed `"<rowId>.<field>"` so the
 * app can mark the offending cell.
 */
export const PATCH = withAuth(async (req) => {
  let patches: CustomerPatchInput[];
  try {
    patches = (await req.json()) as CustomerPatchInput[];
  } catch {
    return fail("Invalid request body");
  }

  if (!Array.isArray(patches)) return fail("Expected an array of changes");

  const parsed = bulkUpdateCustomersSchema.safeParse(patches);
  if (!parsed.success) {
    const rowErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const idx = issue.path[0];
      const field = issue.path[1];
      if (typeof idx === "number" && patches[idx]) {
        (rowErrors[`${patches[idx].id}.${String(field)}`] ??= []).push(issue.message);
      }
    }
    return fail("Some changes are invalid", 422, rowErrors);
  }

  try {
    await bulkUpdateCustomers(parsed.data);
    return ok({ updated: parsed.data.length });
  } catch (error) {
    return failFrom(error, "Failed to save changes");
  }
});

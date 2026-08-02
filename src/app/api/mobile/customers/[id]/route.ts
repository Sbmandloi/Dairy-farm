import { updateCustomerSchema } from "@/lib/schemas/customer.schema";
import {
  deleteCustomer,
  getCustomerById,
  updateCustomer,
} from "@/lib/services/customer.service";
import { withAuth } from "@/lib/mobile/guard";
import { fail, failFrom, notFound, ok } from "@/lib/mobile/response";
import { toBillDTO, toCustomerDTO, toDailyEntryDTO } from "@/lib/mobile/dto";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** GET — the customer with their recent bills and entries, as the detail page shows. */
export const GET = withAuth<Ctx>(async (_req, _session, { params }) => {
  const { id } = await params;
  const customer = await getCustomerById(id);
  if (!customer) return notFound("Customer not found");

  const { bills, dailyEntries, ...base } = customer;
  return ok({
    ...toCustomerDTO(base),
    bills: bills.map(toBillDTO),
    dailyEntries: dailyEntries.map(toDailyEntryDTO),
  });
});

export const PATCH = withAuth<Ctx>(async (req, _session, { params }) => {
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid request body");
  }

  const parsed = updateCustomerSchema.safeParse(body);
  if (!parsed.success) {
    return fail("Validation failed", 422, parsed.error.flatten().fieldErrors as Record<string, string[]>);
  }

  try {
    const customer = await updateCustomer(id, parsed.data);
    return ok(toCustomerDTO(customer));
  } catch (error) {
    return failFrom(error, "Failed to update customer");
  }
});

/**
 * DELETE — archive, not destroy. Calls the same soft-delete the web uses, so the
 * customer's bills, entries and payments are all retained and restorable.
 */
export const DELETE = withAuth<Ctx>(async (_req, _session, { params }) => {
  const { id } = await params;
  try {
    await deleteCustomer(id);
    return ok({ archived: true });
  } catch (error) {
    return failFrom(error, "Failed to archive customer");
  }
});

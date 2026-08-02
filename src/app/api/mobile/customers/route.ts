import { createCustomerSchema } from "@/lib/schemas/customer.schema";
import { createCustomer, getCustomersWithStats } from "@/lib/services/customer.service";
import { withAuth } from "@/lib/mobile/guard";
import { fail, failFrom, ok } from "@/lib/mobile/response";
import { toCustomerDTO } from "@/lib/mobile/dto";

export const dynamic = "force-dynamic";

/**
 * GET /api/mobile/customers?search=&active=true|false&archived=1
 *
 * Mirrors the web Customers page: the same `CustomerScope` filters, the same
 * per-customer stats, and the same exclusion of archived customers unless the
 * archive view is explicitly requested.
 */
export const GET = withAuth(async (req) => {
  const sp = req.nextUrl.searchParams;
  const activeParam = sp.get("active");

  const rows = await getCustomersWithStats({
    search: sp.get("search") || undefined,
    archived: sp.get("archived") === "1" || undefined,
    active: activeParam === null ? undefined : activeParam === "true",
  });

  return ok(
    rows.map(({ stats, ...customer }) => ({
      ...toCustomerDTO(customer),
      stats,
    }))
  );
});

/** POST /api/mobile/customers — same validation and normalisation as the web form. */
export const POST = withAuth(async (req) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid request body");
  }

  const parsed = createCustomerSchema.safeParse(body);
  if (!parsed.success) {
    return fail("Validation failed", 422, parsed.error.flatten().fieldErrors as Record<string, string[]>);
  }

  try {
    const customer = await createCustomer(parsed.data);
    return ok(toCustomerDTO(customer), 201);
  } catch (error) {
    return failFrom(error, "Failed to create customer");
  }
});

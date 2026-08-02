import {
  getCustomerPaymentHistory,
  restoreCustomer,
  toggleCustomerStatus,
} from "@/lib/services/customer.service";
import { sendPaymentReminder } from "@/lib/services/whatsapp.service";
import { withAuth } from "@/lib/mobile/guard";
import { fail, failFrom, ok } from "@/lib/mobile/response";
import { toCustomerDTO } from "@/lib/mobile/dto";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/mobile/customers/[id]/actions { action }
 *
 * The three per-customer operations that are neither a read nor a field edit,
 * behind one endpoint so the app has a single call shape for them:
 *   - "toggle-status" — activate / deactivate
 *   - "restore"       — undo an archive
 *   - "remind"        — send the Hindi WhatsApp dues reminder
 *
 * Each delegates to the exact service the corresponding Server Action calls, so
 * the rules (e.g. a reminder is refused when nothing is outstanding, or when the
 * customer has no phone number) hold identically on mobile.
 */
export const POST = withAuth<Ctx>(async (req, _session, { params }) => {
  const { id } = await params;

  let action: string;
  try {
    action = String(((await req.json()) as { action?: unknown }).action ?? "");
  } catch {
    return fail("Invalid request body");
  }

  switch (action) {
    case "toggle-status":
      try {
        return ok(toCustomerDTO(await toggleCustomerStatus(id)));
      } catch (error) {
        return failFrom(error, "Failed to update status");
      }

    case "restore":
      try {
        return ok(toCustomerDTO(await restoreCustomer(id)));
      } catch (error) {
        return failFrom(error, "Failed to restore customer");
      }

    case "remind":
      try {
        const messageId = await sendPaymentReminder(id);
        return ok({ messageId });
      } catch (error) {
        return failFrom(error, "Failed to send reminder");
      }

    default:
      return fail(`Unknown action "${action}"`);
  }
});

/**
 * GET /api/mobile/customers/[id]/actions — the full payment ledger.
 *
 * Co-located with the actions route because it answers the same question the
 * app asks right after collecting money: what has this customer paid, and what
 * is still open.
 */
export const GET = withAuth<Ctx>(async (_req, _session, { params }) => {
  const { id } = await params;
  const history = await getCustomerPaymentHistory(id);

  return ok({
    payments: history.payments.map((p) => ({
      id: p.id,
      amountPaid: p.amountPaid,
      paidOn: p.paidOn.toISOString().slice(0, 10),
      note: p.note,
      bill: {
        id: p.bill.id,
        invoiceNumber: p.bill.invoiceNumber,
        status: p.bill.status,
        periodStart: p.bill.periodStart.toISOString().slice(0, 10),
        periodEnd: p.bill.periodEnd.toISOString().slice(0, 10),
        totalAmount: p.bill.totalAmount,
        // Map is not JSON-serializable; flatten it onto the row that needs it.
        stillDue: Math.max(0, history.pendingByBill.get(p.bill.id) ?? 0),
      },
    })),
    totals: {
      totalBilled: history.totalBilled,
      totalPaid: history.totalPaid,
      totalPending: history.totalPending,
      unpaidBills: history.unpaidBills,
    },
  });
});

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { decimalToNumber } from "@/lib/utils/format";
import type { RecordCollectionInput, UpdateCollectionInput } from "@/lib/schemas/payment.schema";

/** Money is stored to 2dp; keep arithmetic there too so cents don't drift. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Anything under a paisa is rounding noise, not a real balance. */
const EPSILON = 0.01;

export type CollectionEntry = {
  id: string;
  amount: number;
  paidOn: string; // "YYYY-MM-DD"
  note: string | null;
  createdAt: string; // ISO
  bill: {
    id: string;
    invoiceNumber: string;
    periodStart: string;
    periodEnd: string;
    totalAmount: number;
    /** What is still owed on this bill, after every payment against it. */
    stillDue: number;
  };
};

export type CollectionResult = {
  amount: number;
  /** Which bills the money was applied to, oldest first. */
  allocations: { invoiceNumber: string; amount: number }[];
  /** What the customer still owes once this collection is applied. */
  remainingPending: number;
};

/**
 * Re-derive a bill's status from the payments that actually exist against it.
 * Called after any payment is added, edited or removed, so a corrected entry
 * can never leave a bill stuck on PAID.
 */
async function recomputeBillStatus(tx: Prisma.TransactionClient, billId: string) {
  const bill = await tx.bill.findUniqueOrThrow({
    where: { id: billId },
    include: { payments: { select: { amountPaid: true } } },
  });

  const total = decimalToNumber(bill.totalAmount);
  const paid = bill.payments.reduce((s, p) => s + decimalToNumber(p.amountPaid), 0);

  let status: "PAID" | "PARTIALLY_PAID" | "SENT" | "GENERATED";
  if (paid >= total - EPSILON) status = "PAID";
  else if (paid > EPSILON) status = "PARTIALLY_PAID";
  // No payments left — fall back to whether the bill had already gone out.
  else status = bill.sentAt ? "SENT" : "GENERATED";

  await tx.bill.update({ where: { id: billId }, data: { status } });
}

/**
 * Log cash collected from a customer. The amount is settled against their
 * outstanding bills oldest-first, so the debt that has been waiting longest
 * clears before a newer one — which is how the farmer would apply it on paper.
 * A collection spanning three bills becomes three payment rows, each carrying
 * the same note, so the ledger always says which invoice the money settled.
 */
export async function recordCollection({
  customerId,
  amount,
  paidOn,
  note,
}: RecordCollectionInput): Promise<CollectionResult> {
  return prisma.$transaction(async (tx) => {
    const bills = await tx.bill.findMany({
      where: { customerId },
      orderBy: [{ periodEnd: "asc" }, { createdAt: "asc" }],
      include: { payments: { select: { amountPaid: true } } },
    });

    const outstanding = bills
      .map((bill) => ({
        bill,
        due: round2(
          decimalToNumber(bill.totalAmount) -
            bill.payments.reduce((s, p) => s + decimalToNumber(p.amountPaid), 0)
        ),
      }))
      .filter((row) => row.due > EPSILON);

    const totalDue = round2(outstanding.reduce((s, r) => s + r.due, 0));

    if (totalDue <= EPSILON) {
      throw new Error(
        "This customer has nothing outstanding. Generate a bill before recording a collection."
      );
    }
    if (amount - totalDue > EPSILON) {
      throw new Error(
        `Amount is more than the ₹${totalDue.toFixed(2)} outstanding. Enter ₹${totalDue.toFixed(2)} or less.`
      );
    }

    const allocations: { invoiceNumber: string; amount: number }[] = [];
    let left = amount;

    for (const { bill, due } of outstanding) {
      if (left <= EPSILON) break;

      const slice = round2(Math.min(due, left));
      await tx.payment.create({
        data: {
          billId: bill.id,
          amountPaid: slice,
          paidOn: new Date(paidOn),
          note: note || null,
        },
      });
      await recomputeBillStatus(tx, bill.id);

      allocations.push({ invoiceNumber: bill.invoiceNumber, amount: slice });
      left = round2(left - slice);
    }

    return { amount, allocations, remainingPending: round2(totalDue - amount) };
  });
}

/**
 * Correct an already-logged payment. Rejects an amount that would push the bill
 * past its total, so a typo can't silently create an overpaid bill.
 */
export async function updateCollection({ paymentId, amount, paidOn, note }: UpdateCollectionInput) {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUniqueOrThrow({
      where: { id: paymentId },
      include: { bill: { include: { payments: { select: { id: true, amountPaid: true } } } } },
    });

    const billTotal = decimalToNumber(payment.bill.totalAmount);
    const paidByOthers = payment.bill.payments
      .filter((p) => p.id !== paymentId)
      .reduce((s, p) => s + decimalToNumber(p.amountPaid), 0);
    const headroom = round2(billTotal - paidByOthers);

    if (amount - headroom > EPSILON) {
      throw new Error(
        `₹${amount.toFixed(2)} is more than the ₹${headroom.toFixed(2)} left on invoice ${payment.bill.invoiceNumber}.`
      );
    }

    await tx.payment.update({
      where: { id: paymentId },
      data: { amountPaid: amount, paidOn: new Date(paidOn), note: note || null },
    });
    await recomputeBillStatus(tx, payment.billId);
  });
}

/** Remove a payment that was logged in error, and put its bill back where it belongs. */
export async function deleteCollection(paymentId: string) {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
    await tx.payment.delete({ where: { id: paymentId } });
    await recomputeBillStatus(tx, payment.billId);
  });
}

/**
 * Every payment ever collected, keyed by customer and newest first — one query for
 * the whole manager page, so opening a customer's ledger needs no round trip. Fully
 * serialized: no Decimal/Date instances cross to the client.
 */
export async function getCollectionsByCustomer(): Promise<Record<string, CollectionEntry[]>> {
  const bills = await prisma.bill.findMany({ include: { payments: true } });

  const byCustomer: Record<string, CollectionEntry[]> = {};
  for (const bill of bills) {
    (byCustomer[bill.customerId] ??= []).push(...toEntries(bill));
  }

  for (const entries of Object.values(byCustomer)) entries.sort(newestFirst);
  return byCustomer;
}

function newestFirst(a: CollectionEntry, b: CollectionEntry): number {
  return a.paidOn === b.paidOn
    ? b.createdAt.localeCompare(a.createdAt)
    : b.paidOn.localeCompare(a.paidOn);
}

type BillWithPayments = Prisma.BillGetPayload<{ include: { payments: true } }>;

function toEntries(bill: BillWithPayments): CollectionEntry[] {
  const paid = bill.payments.reduce((s, p) => s + decimalToNumber(p.amountPaid), 0);
  const stillDue = round2(decimalToNumber(bill.totalAmount) - paid);

  return bill.payments.map((p) => ({
    id: p.id,
    amount: decimalToNumber(p.amountPaid),
    paidOn: p.paidOn.toISOString().slice(0, 10),
    note: p.note,
    createdAt: p.createdAt.toISOString(),
    bill: {
      id: bill.id,
      invoiceNumber: bill.invoiceNumber,
      periodStart: bill.periodStart.toISOString().slice(0, 10),
      periodEnd: bill.periodEnd.toISOString().slice(0, 10),
      totalAmount: decimalToNumber(bill.totalAmount),
      stillDue: Math.max(0, stillDue),
    },
  }));
}

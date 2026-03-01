import { prisma } from "@/lib/db";

export async function generateInvoiceNumber(
  _customerId: string,
  periodStart: Date
): Promise<string> {
  const year = periodStart.getFullYear();
  const month = String(periodStart.getMonth() + 1).padStart(2, "0");

  // Find the highest sequence number across ALL months this year to avoid collisions
  const allThisYear = await prisma.bill.findMany({
    where: { invoiceNumber: { startsWith: `INV-${year}-` } },
    select: { invoiceNumber: true },
  });

  let maxSeq = 0;
  for (const { invoiceNumber } of allThisYear) {
    const parts = invoiceNumber.split("-");
    const seq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
  }

  // Loop until we find a candidate that doesn't already exist (handles race conditions)
  let nextSeq = maxSeq + 1;
  let candidate = `INV-${year}-${month}-${String(nextSeq).padStart(3, "0")}`;
  while (await prisma.bill.findFirst({ where: { invoiceNumber: candidate }, select: { id: true } })) {
    nextSeq++;
    candidate = `INV-${year}-${month}-${String(nextSeq).padStart(3, "0")}`;
  }

  return candidate;
}

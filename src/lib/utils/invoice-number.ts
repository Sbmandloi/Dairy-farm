import { prisma } from "@/lib/db";

export async function generateInvoiceNumber(
  customerId: string,
  periodStart: Date
): Promise<string> {
  const year = periodStart.getFullYear();
  const month = String(periodStart.getMonth() + 1).padStart(2, "0");

  // Find the highest existing invoice number for this year so we never collide
  const last = await prisma.bill.findFirst({
    where: { invoiceNumber: { startsWith: `INV-${year}-` } },
    orderBy: { invoiceNumber: "desc" },
    select: { invoiceNumber: true },
  });

  let nextSeq = 1;
  if (last?.invoiceNumber) {
    // Format: INV-YYYY-MM-NNN — the sequence is always the last segment
    const parts = last.invoiceNumber.split("-");
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
  }

  return `INV-${year}-${month}-${String(nextSeq).padStart(3, "0")}`;
}

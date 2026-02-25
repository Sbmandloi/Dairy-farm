import { prisma } from "@/lib/db";

export async function generateInvoiceNumber(
  customerId: string,
  periodStart: Date
): Promise<string> {
  const year = periodStart.getFullYear();
  const month = String(periodStart.getMonth() + 1).padStart(2, "0");

  const count = await prisma.bill.count({
    where: {
      periodStart: {
        gte: new Date(year, 0, 1),
        lt: new Date(year + 1, 0, 1),
      },
    },
  });

  const seq = String(count + 1).padStart(3, "0");
  return `INV-${year}-${month}-${seq}`;
}

import { z } from "zod";

export const generateBillsSchema = z.object({
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  customerId: z.string().cuid().optional(),
});

export const markPaidSchema = z.object({
  billId: z.string().cuid(),
  amountPaid: z.number().positive("Amount must be positive"),
  paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().optional(),
});

export type GenerateBillsInput = z.infer<typeof generateBillsSchema>;
export type MarkPaidInput = z.infer<typeof markPaidSchema>;

import { z } from "zod";

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date");
const note = z.string().trim().max(300, "Note must be 300 characters or less").optional();

/** Cash collected from a customer, settled against their outstanding bills. */
export const recordCollectionSchema = z.object({
  customerId: z.string().cuid(),
  amount: z.number().positive("Amount must be greater than 0"),
  paidOn: dateOnly,
  note,
});

/** Correcting a collection that was already logged. */
export const updateCollectionSchema = z.object({
  paymentId: z.string().cuid(),
  amount: z.number().positive("Amount must be greater than 0"),
  paidOn: dateOnly,
  note,
});

export type RecordCollectionInput = z.infer<typeof recordCollectionSchema>;
export type UpdateCollectionInput = z.infer<typeof updateCollectionSchema>;

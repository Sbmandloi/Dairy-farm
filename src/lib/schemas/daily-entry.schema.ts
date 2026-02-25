import { z } from "zod";

export const dailyEntryItemSchema = z.object({
  customerId: z.string().cuid(),
  morningLiters: z.number().min(0).optional(),
  eveningLiters: z.number().min(0).optional(),
  totalLiters: z.number().min(0),
  notes: z.string().optional(),
});

export const saveDailyEntriesSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  entries: z.array(dailyEntryItemSchema),
});

export type DailyEntryItemInput = z.infer<typeof dailyEntryItemSchema>;
export type SaveDailyEntriesInput = z.infer<typeof saveDailyEntriesSchema>;

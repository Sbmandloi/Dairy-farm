import { z } from "zod";

export const dailyEntryItemSchema = z.object({
  customerId: z.string().cuid(),
  // nullable so an explicitly-cleared morning/evening is a valid "wipe it" signal.
  morningLiters: z.number().min(0).nullable().optional(),
  eveningLiters: z.number().min(0).nullable().optional(),
  totalLiters: z.number().min(0),
  notes: z.string().nullable().optional(),
});

export const saveDailyEntriesSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  entries: z.array(dailyEntryItemSchema),
});

export type DailyEntryItemInput = z.infer<typeof dailyEntryItemSchema>;
export type SaveDailyEntriesInput = z.infer<typeof saveDailyEntriesSchema>;

"use server";

import { revalidatePath } from "next/cache";
import { saveDailyEntriesSchema } from "@/lib/schemas/daily-entry.schema";
import { saveDailyEntries, copyPreviousDay } from "@/lib/services/daily-entry.service";
import { ActionResult } from "@/types";

export async function saveDailyEntriesAction(
  date: string,
  entries: { customerId: string; morningLiters?: number; eveningLiters?: number; totalLiters: number; notes?: string }[]
): Promise<ActionResult<void>> {
  try {
    const parsed = saveDailyEntriesSchema.safeParse({ date, entries });
    if (!parsed.success) {
      return { success: false, error: "Validation failed" };
    }

    await saveDailyEntries(new Date(date), parsed.data.entries);
    revalidatePath("/daily-entry");
    revalidatePath("/dashboard");
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to save entries" };
  }
}

export async function saveMonthlyEntriesAction(
  changes: Array<{
    date: string;
    customerId: string;
    totalLiters: number;
    morningLiters?: number | null;
    eveningLiters?: number | null;
  }>
): Promise<ActionResult<void>> {
  try {
    // Group by date for efficient batch saves
    const byDate = new Map<string, typeof changes>();
    for (const change of changes) {
      if (!byDate.has(change.date)) byDate.set(change.date, []);
      byDate.get(change.date)!.push(change);
    }

    for (const [dateStr, dateEntries] of byDate) {
      await saveDailyEntries(
        new Date(dateStr),
        dateEntries.map((e) => ({
          customerId: e.customerId,
          morningLiters: e.morningLiters ?? undefined,
          eveningLiters: e.eveningLiters ?? undefined,
          totalLiters: e.totalLiters,
        }))
      );
    }

    revalidatePath("/monthly-entry");
    revalidatePath("/daily-entry");
    revalidatePath("/dashboard");
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to save entries" };
  }
}

export async function copyPreviousDayAction(targetDate: string): Promise<ActionResult<{
  customerId: string;
  morningLiters: number | null;
  eveningLiters: number | null;
  totalLiters: number;
}[]>> {
  try {
    const entries = await copyPreviousDay(new Date(targetDate));
    // Serialize Decimal → number so it can cross the Server Action boundary
    const serialized = entries.map((e) => ({
      customerId: e.customerId,
      morningLiters: e.morningLiters != null ? parseFloat(String(e.morningLiters)) : null,
      eveningLiters: e.eveningLiters != null ? parseFloat(String(e.eveningLiters)) : null,
      totalLiters: parseFloat(String(e.totalLiters)),
    }));
    return { success: true, data: serialized };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to copy entries" };
  }
}

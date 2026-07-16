"use server";

import { revalidatePath } from "next/cache";
import { previewCustomerStatement } from "@/lib/services/statement.service";
import { sendStatementViaWhatsApp } from "@/lib/services/whatsapp.service";
import { ActionResult } from "@/types";

export type StatementPreview = {
  months: { key: string; liters: number; pricePerLiter: number; amount: number; paid: number }[];
  emptyMonths: string[];
  totals: { liters: number; amount: number; paid: number; due: number };
};

/**
 * The live numbers for the months the user has picked — quantities summed from
 * their daily entries and the rate read from the database. Read-only: this does
 * NOT create any bills, so the user can explore month combinations freely.
 */
export async function previewStatementAction(
  customerId: string,
  months: string[]
): Promise<ActionResult<StatementPreview>> {
  try {
    if (!customerId) return { success: false, error: "Select a customer first." };
    if (months.length === 0) return { success: false, error: "Select at least one month." };
    const data = await previewCustomerStatement(customerId, months);
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Could not load the bill preview",
    };
  }
}

/** Generate (if needed) and send the consolidated statement on WhatsApp. */
export async function sendStatementAction(
  customerId: string,
  months: string[],
  notes?: string | null
): Promise<ActionResult<void>> {
  try {
    await sendStatementViaWhatsApp(customerId, months, notes);
    // Building the statement upserts the monthly bills, so billing views change.
    revalidatePath("/billing");
    revalidatePath("/dashboard");
    revalidatePath("/customer-manager");
    revalidatePath(`/customers/${customerId}`);
    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send the bill",
    };
  }
}

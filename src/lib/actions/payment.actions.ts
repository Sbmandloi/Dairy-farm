"use server";

import { revalidatePath } from "next/cache";
import { recordCollectionSchema, updateCollectionSchema } from "@/lib/schemas/payment.schema";
import {
  recordCollection,
  updateCollection,
  deleteCollection,
  type CollectionResult,
} from "@/lib/services/payment.service";
import { ActionResult } from "@/types";

/** Anything showing a customer's dues goes stale the moment money is collected. */
function revalidateMoney(customerId: string) {
  revalidatePath("/customer-manager");
  revalidatePath("/customers");
  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/billing");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
}

export async function recordCollectionAction(input: {
  customerId: string;
  amount: number;
  paidOn: string;
  note?: string;
}): Promise<ActionResult<CollectionResult>> {
  try {
    const parsed = recordCollectionSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: "Validation failed",
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const result = await recordCollection(parsed.data);
    revalidateMoney(parsed.data.customerId);
    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to record collection",
    };
  }
}

export async function updateCollectionAction(
  customerId: string,
  input: { paymentId: string; amount: number; paidOn: string; note?: string }
): Promise<ActionResult<void>> {
  try {
    const parsed = updateCollectionSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: "Validation failed",
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    await updateCollection(parsed.data);
    revalidateMoney(customerId);
    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update payment",
    };
  }
}

export async function deleteCollectionAction(
  customerId: string,
  paymentId: string
): Promise<ActionResult<void>> {
  try {
    await deleteCollection(paymentId);
    revalidateMoney(customerId);
    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete payment",
    };
  }
}

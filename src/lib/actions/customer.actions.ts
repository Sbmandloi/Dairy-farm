"use server";

import { revalidatePath } from "next/cache";
import {
  createCustomerSchema,
  updateCustomerSchema,
  bulkUpdateCustomersSchema,
  CustomerPatchInput,
} from "@/lib/schemas/customer.schema";
import { createCustomer, updateCustomer, toggleCustomerStatus, deleteCustomer, restoreCustomer, bulkUpdateCustomers } from "@/lib/services/customer.service";
import { sendPaymentReminder } from "@/lib/services/whatsapp.service";
import { ActionResult } from "@/types";

export async function createCustomerAction(formData: FormData): Promise<ActionResult<void>> {
  try {
    const raw = {
      name: formData.get("name"),
      phoneNumber: formData.get("phoneNumber"),
      address: formData.get("address"),
      pricePerLiter: formData.get("pricePerLiter"),
      startDate: formData.get("startDate"),
    };

    const parsed = createCustomerSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        success: false,
        error: "Validation failed",
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    await createCustomer(parsed.data);
    revalidatePath("/customers");
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to create customer" };
  }
}

export async function updateCustomerAction(id: string, formData: FormData): Promise<ActionResult<void>> {
  try {
    const raw = {
      name: formData.get("name"),
      phoneNumber: formData.get("phoneNumber"),
      address: formData.get("address"),
      pricePerLiter: formData.get("pricePerLiter"),
      startDate: formData.get("startDate"),
    };

    const parsed = updateCustomerSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        success: false,
        error: "Validation failed",
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    await updateCustomer(id, parsed.data);
    revalidatePath("/customers");
    revalidatePath(`/customers/${id}`);
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to update customer" };
  }
}

export async function toggleCustomerStatusAction(id: string): Promise<ActionResult<void>> {
  try {
    await toggleCustomerStatus(id);
    revalidatePath("/customers");
    revalidatePath(`/customers/${id}`);
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to update status" };
  }
}

/**
 * Commit the batch of edits staged in the customer manager. Validates every patch
 * up front and rejects the whole batch if any row is invalid, so the user never
 * ends up with a partially-applied save they didn't notice.
 */
export async function bulkUpdateCustomersAction(
  patches: CustomerPatchInput[]
): Promise<ActionResult<{ updated: number }>> {
  try {
    const parsed = bulkUpdateCustomersSchema.safeParse(patches);
    if (!parsed.success) {
      // Map Zod's array-index paths back to the row id the user can actually see.
      const rowErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const idx = issue.path[0];
        const field = issue.path[1];
        if (typeof idx === "number" && patches[idx]) {
          const key = `${patches[idx].id}.${String(field)}`;
          (rowErrors[key] ??= []).push(issue.message);
        }
      }
      return { success: false, error: "Some changes are invalid", fieldErrors: rowErrors };
    }

    await bulkUpdateCustomers(parsed.data);

    revalidatePath("/customer-manager");
    revalidatePath("/customers");
    return { success: true, data: { updated: parsed.data.length } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to save changes",
    };
  }
}

export async function sendPaymentReminderAction(id: string): Promise<ActionResult<void>> {
  try {
    await sendPaymentReminder(id);
    revalidatePath("/customer-manager");
    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send reminder",
    };
  }
}

/**
 * Archive (soft delete) a customer. Nothing is removed from the database — the
 * customer and all their bills/entries/payments are just hidden from the UI and
 * can be restored. Revalidates every surface where their data would otherwise
 * still appear.
 */
export async function deleteCustomerAction(id: string): Promise<ActionResult<void>> {
  try {
    await deleteCustomer(id);
    revalidateCustomerSurfaces(id);
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to archive customer" };
  }
}

/** Restore a previously archived customer (and their retained history). */
export async function restoreCustomerAction(id: string): Promise<ActionResult<void>> {
  try {
    await restoreCustomer(id);
    revalidateCustomerSurfaces(id);
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to restore customer" };
  }
}

/** Every page whose data changes when a customer is archived or restored. */
function revalidateCustomerSurfaces(id: string) {
  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
  revalidatePath("/customer-manager");
  revalidatePath("/dashboard");
  revalidatePath("/billing");
  revalidatePath("/reports");
}

"use server";

import { revalidatePath } from "next/cache";
import { createCustomerSchema, updateCustomerSchema } from "@/lib/schemas/customer.schema";
import { createCustomer, updateCustomer, toggleCustomerStatus } from "@/lib/services/customer.service";
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

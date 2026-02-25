"use server";

import { revalidatePath } from "next/cache";
import { updateSettingsSchema } from "@/lib/schemas/settings.schema";
import { updateSettings } from "@/lib/services/settings.service";
import { encrypt } from "@/lib/utils/encryption";
import { ActionResult } from "@/types";

export async function updateSettingsAction(formData: FormData): Promise<ActionResult<void>> {
  try {
    const raw = {
      farmName: formData.get("farmName"),
      farmAddress: formData.get("farmAddress"),
      farmPhone: formData.get("farmPhone"),
      globalPricePerLiter: formData.get("globalPricePerLiter"),
      billingCycleType: formData.get("billingCycleType") || "MONTHLY",
      entryMode: formData.get("entryMode") || "SPLIT",
      whatsappBusinessAcctId: formData.get("whatsappBusinessAcctId"),
      whatsappPhoneNumberId: formData.get("whatsappPhoneNumberId"),
      whatsappAccessToken: formData.get("whatsappAccessToken"),
      whatsappTemplateName: formData.get("whatsappTemplateName"),
    };

    const parsed = updateSettingsSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        success: false,
        error: "Validation failed",
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const data = { ...parsed.data };

    // Encrypt WhatsApp token if provided
    if (data.whatsappAccessToken && data.whatsappAccessToken.length > 20) {
      try {
        data.whatsappAccessToken = encrypt(data.whatsappAccessToken);
      } catch {
        // Skip encryption if key not configured
      }
    }

    await updateSettings(data as unknown as Parameters<typeof updateSettings>[0]);
    revalidatePath("/settings");
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to update settings" };
  }
}

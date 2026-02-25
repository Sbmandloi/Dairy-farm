import { z } from "zod";

export const updateSettingsSchema = z.object({
  farmName: z.string().min(2, "Farm name is required"),
  farmAddress: z.string().optional(),
  farmPhone: z.string().optional(),
  globalPricePerLiter: z
    .string()
    .min(1)
    .transform((v) => parseFloat(v))
    .pipe(z.number().positive("Price must be positive")),
  billingCycleType: z.enum(["MONTHLY"]),
  entryMode: z.enum(["SPLIT", "SINGLE"]),
  whatsappBusinessAcctId: z.string().optional(),
  whatsappPhoneNumberId: z.string().optional(),
  whatsappAccessToken: z.string().optional(),
  whatsappTemplateName: z.string().optional(),
});

export type UpdateSettingsInput = z.input<typeof updateSettingsSchema>;

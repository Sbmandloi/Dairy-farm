import { z } from "zod";

export const createCustomerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  phoneNumber: z
    .string()
    .regex(/^\+?[0-9]{10,13}$/, "Enter a valid phone number"),
  address: z.string().optional(),
  pricePerLiter: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : parseFloat(String(v))),
    z.number().positive().optional()
  ),
  startDate: z.string().min(1, "Start date is required"),
});

export const updateCustomerSchema = createCustomerSchema.partial();

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;

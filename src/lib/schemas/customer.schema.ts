import { z } from "zod";

export const createCustomerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  // Optional: a customer may be created without a phone number. When one is
  // given it must still be valid, since WhatsApp invoicing depends on it.
  // Empty input becomes null (not undefined) so that clearing the field on
  // edit actually removes the stored number.
  phoneNumber: z.preprocess(
    (v) => {
      if (v === null || v === undefined) return null;
      const s = String(v).replace(/[\s-]/g, "");
      return s === "" ? null : s;
    },
    z.string().regex(/^\+?[0-9]{10,13}$/, "Enter a valid phone number").nullable()
  ),
  address: z.string().optional(),
  pricePerLiter: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : parseFloat(String(v))),
    z.number().positive().optional()
  ),
  startDate: z.string().min(1, "Start date is required"),
});

export const updateCustomerSchema = createCustomerSchema.partial();

/**
 * A single row's staged edits from the customer manager. Every field is optional
 * because only the fields the user actually touched are sent; `undefined` means
 * "leave alone", which is distinct from `null` ("clear it").
 */
export const customerPatchSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(2, "Name must be at least 2 characters").optional(),
  phoneNumber: z
    .preprocess(
      (v) => {
        if (v === null || v === undefined) return null;
        const s = String(v).replace(/[\s-]/g, "");
        return s === "" ? null : s;
      },
      z.string().regex(/^\+?[0-9]{10,13}$/, "Enter a valid phone number").nullable()
    )
    .optional(),
  address: z.string().optional(),
  pricePerLiter: z
    .preprocess(
      (v) => (v === "" || v === null || v === undefined ? null : parseFloat(String(v))),
      z.number().positive("Rate must be greater than 0").nullable()
    )
    .optional(),
  isActive: z.boolean().optional(),
});

export const bulkUpdateCustomersSchema = z
  .array(customerPatchSchema)
  .min(1, "No changes to save");

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
/** Parsed/validated patch — what the service layer consumes. */
export type CustomerPatch = z.infer<typeof customerPatchSchema>;
/** Raw patch as the client sends it (price/phone arrive as strings from inputs). */
export type CustomerPatchInput = z.input<typeof customerPatchSchema>;

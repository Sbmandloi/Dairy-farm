import { router } from "expo-router";
import { useCreateCustomer, useSettings } from "@/hooks/queries";
import {
  CustomerForm,
  EMPTY_CUSTOMER,
  toCustomerInput,
  type CustomerFormValues,
} from "@/components/customer-form";
import { useFeedback } from "@/components/feedback";

/** Add a customer. */
export default function NewCustomerScreen() {
  const feedback = useFeedback();
  const create = useCreateCustomer();
  const { data: settings } = useSettings();

  async function handleSubmit(values: CustomerFormValues) {
    try {
      const customer = await create.mutateAsync(toCustomerInput(values));
      feedback.success(`${customer.name} added.`);
      // Replace rather than push, so backing out of the new customer's page
      // returns to the list instead of re-opening the empty form.
      router.replace(`/customer/${customer.id}`);
    } catch (error) {
      // Field errors are rendered by the form; anything else needs the snackbar.
      feedback.error(error);
      throw error;
    }
  }

  return (
    <CustomerForm
      initial={EMPTY_CUSTOMER}
      submitLabel="Add customer"
      onSubmit={handleSubmit}
      submitting={create.isPending}
      globalRate={settings?.globalPricePerLiter}
    />
  );
}

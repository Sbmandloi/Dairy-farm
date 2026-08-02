import { router, useLocalSearchParams } from "expo-router";
import { useCustomer, useSettings, useUpdateCustomer } from "@/hooks/queries";
import {
  CustomerForm,
  toCustomerInput,
  type CustomerFormValues,
} from "@/components/customer-form";
import { useFeedback } from "@/components/feedback";
import { CenteredLoader, ErrorScreen } from "@/components/states";

/** Edit an existing customer. */
export default function EditCustomerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const feedback = useFeedback();

  const { data, isLoading, isError, error, refetch } = useCustomer(id);
  const update = useUpdateCustomer(id);
  const { data: settings } = useSettings();

  if (isLoading) return <CenteredLoader label="Loading customer…" />;
  if (isError || !data) return <ErrorScreen error={error} onRetry={() => void refetch()} />;

  async function handleSubmit(values: CustomerFormValues) {
    try {
      await update.mutateAsync(toCustomerInput(values));
      feedback.success("Changes saved.");
      router.back();
    } catch (e) {
      feedback.error(e);
      throw e;
    }
  }

  return (
    <CustomerForm
      initial={{
        name: data.name,
        phoneNumber: data.phoneNumber ?? "",
        address: data.address ?? "",
        pricePerLiter: data.pricePerLiter !== null ? String(data.pricePerLiter) : "",
        startDate: data.startDate,
      }}
      submitLabel="Save changes"
      onSubmit={handleSubmit}
      submitting={update.isPending}
      globalRate={settings?.globalPricePerLiter}
    />
  );
}

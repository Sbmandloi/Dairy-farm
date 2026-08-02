import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from "react-native";
import { Button, HelperText, Text, TextInput, useTheme } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ApiError } from "@/api/errors";
import type { CustomerInput } from "@/api/endpoints";
import { SectionCard } from "@/components/ui";
import { radius, spacing } from "@/theme";
import type { AppTheme } from "@/theme";
import { today } from "@/utils/date";
import { formatDate } from "@/utils/format";

/**
 * Add / edit customer.
 *
 * Shared by both screens so the two can never validate differently. The rules
 * mirror the server's `createCustomerSchema` exactly — name of at least two
 * characters, an optional but well-formed phone number, an optional custom rate
 * — and are checked here only to give immediate feedback. The server remains
 * the authority: a field error it returns is mapped straight back onto the
 * field it names.
 */

export interface CustomerFormValues {
  name: string;
  phoneNumber: string;
  address: string;
  pricePerLiter: string;
  startDate: string;
}

export const EMPTY_CUSTOMER: CustomerFormValues = {
  name: "",
  phoneNumber: "",
  address: "",
  pricePerLiter: "",
  startDate: today(),
};

type Errors = Partial<Record<keyof CustomerFormValues, string>>;

/** Client-side mirror of the server's rules, for instant feedback only. */
function validate(values: CustomerFormValues): Errors {
  const errors: Errors = {};

  if (values.name.trim().length < 2) {
    errors.name = "Name must be at least 2 characters";
  }

  const phone = values.phoneNumber.replace(/[\s-]/g, "");
  if (phone && !/^\+?[0-9]{10,13}$/.test(phone)) {
    errors.phoneNumber = "Enter a valid phone number";
  }

  if (values.pricePerLiter.trim()) {
    const rate = parseFloat(values.pricePerLiter);
    if (Number.isNaN(rate) || rate <= 0) errors.pricePerLiter = "Rate must be greater than 0";
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(values.startDate)) {
    errors.startDate = "Start date is required";
  }

  return errors;
}

/** Form values → the API's input shape. */
export function toCustomerInput(values: CustomerFormValues): CustomerInput {
  const phone = values.phoneNumber.replace(/[\s-]/g, "");
  return {
    name: values.name.trim(),
    // null, not "": clearing the field on edit must actually remove the number.
    phoneNumber: phone || null,
    address: values.address.trim() || undefined,
    pricePerLiter: values.pricePerLiter.trim() || null,
    startDate: values.startDate,
  };
}

export function CustomerForm({
  initial,
  submitLabel,
  onSubmit,
  submitting,
  globalRate,
}: {
  initial: CustomerFormValues;
  submitLabel: string;
  onSubmit: (values: CustomerFormValues) => Promise<void>;
  submitting: boolean;
  globalRate?: number;
}) {
  const theme = useTheme<AppTheme>();
  const insets = useSafeAreaInsets();

  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [touched, setTouched] = useState(false);

  const set = (key: keyof CustomerFormValues) => (text: string) => {
    setValues((prev) => ({ ...prev, [key]: text }));
    // Clear a field's error as soon as the user starts fixing it.
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  async function handleSubmit() {
    const found = validate(values);
    setTouched(true);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    try {
      await onSubmit(values);
    } catch (error) {
      // Map server field errors back onto the inputs that produced them.
      if (error instanceof ApiError && error.fieldErrors) {
        const mapped: Errors = {};
        for (const [field, messages] of Object.entries(error.fieldErrors)) {
          if (field in values && messages[0]) mapped[field as keyof CustomerFormValues] = messages[0];
        }
        setErrors(mapped);
      }
      throw error;
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
        keyboardShouldPersistTaps="handled"
      >
        <SectionCard title="Who they are" icon="account-outline">
          <TextInput
            label="Name *"
            value={values.name}
            onChangeText={set("name")}
            mode="outlined"
            autoCapitalize="words"
            error={touched && Boolean(errors.name)}
          />
          <HelperText type="error" visible={Boolean(errors.name)}>
            {errors.name}
          </HelperText>

          <TextInput
            label="Phone number"
            value={values.phoneNumber}
            onChangeText={set("phoneNumber")}
            mode="outlined"
            keyboardType="phone-pad"
            placeholder="98765 43210"
            error={touched && Boolean(errors.phoneNumber)}
            left={<TextInput.Icon icon="phone-outline" />}
          />
          <HelperText type={errors.phoneNumber ? "error" : "info"} visible>
            {errors.phoneNumber ?? "Needed to send bills and reminders on WhatsApp."}
          </HelperText>

          <TextInput
            label="Address"
            value={values.address}
            onChangeText={set("address")}
            mode="outlined"
            multiline
            numberOfLines={2}
          />
        </SectionCard>

        <SectionCard title="Billing" icon="cash">
          <TextInput
            label="Custom rate per litre"
            value={values.pricePerLiter}
            onChangeText={set("pricePerLiter")}
            mode="outlined"
            keyboardType="decimal-pad"
            placeholder={globalRate ? String(globalRate) : "Leave blank for the global rate"}
            error={touched && Boolean(errors.pricePerLiter)}
            left={<TextInput.Icon icon="currency-inr" />}
          />
          <HelperText type={errors.pricePerLiter ? "error" : "info"} visible>
            {errors.pricePerLiter ??
              (globalRate
                ? `Leave blank to use the global rate of ₹${globalRate}/L.`
                : "Leave blank to use the global rate.")}
          </HelperText>

          <TextInput
            label="Start date *"
            value={values.startDate}
            onChangeText={set("startDate")}
            mode="outlined"
            placeholder="YYYY-MM-DD"
            keyboardType="numbers-and-punctuation"
            error={touched && Boolean(errors.startDate)}
            left={<TextInput.Icon icon="calendar-outline" />}
          />
          <HelperText type={errors.startDate ? "error" : "info"} visible>
            {errors.startDate ??
              (/^\d{4}-\d{2}-\d{2}$/.test(values.startDate)
                ? formatDate(values.startDate)
                : "Use YYYY-MM-DD.")}
          </HelperText>
        </SectionCard>

        <Button
          mode="contained"
          onPress={handleSubmit}
          loading={submitting}
          disabled={submitting}
          style={styles.submit}
          contentStyle={styles.submitContent}
        >
          {submitLabel}
        </Button>

        <Text
          variant="labelSmall"
          style={[styles.note, { color: theme.colors.onSurfaceVariant }]}
        >
          * Required
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.lg },
  submit: { borderRadius: radius.full },
  submitContent: { height: 52 },
  note: { textAlign: "center" },
});

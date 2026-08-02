import { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  Button,
  Chip,
  Dialog,
  Icon,
  Portal,
  Text,
  TextInput,
  TouchableRipple,
  useTheme,
} from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCustomers, usePreviewStatement, useSendStatement } from "@/hooks/queries";
import { statementPdfPath } from "@/api/endpoints";
import { sharePdf } from "@/utils/download";
import { useFeedback } from "@/components/feedback";
import { SearchField } from "@/components/navigators";
import { CenteredLoader, EmptyState } from "@/components/states";
import { CustomerAvatar, Divider, Money, SectionCard } from "@/components/ui";
import { radius, spacing } from "@/theme";
import type { AppTheme } from "@/theme";
import { recentMonths } from "@/utils/date";
import { formatCurrency, formatLiters, formatMonth, formatMonthShort } from "@/utils/format";
import type { CustomerWithStats, StatementPreview } from "@/api/types";

/**
 * Quick bill — bill one customer for one or more months at once.
 *
 * Quantities are summed from their daily entries and the rate is read from
 * their record; nothing is typed in. The preview is read-only and creates no
 * bills, so months can be explored freely — only printing or sending commits
 * the underlying monthly bills, exactly as on the web.
 */
export default function QuickBillScreen() {
  const theme = useTheme<AppTheme>();
  const insets = useSafeAreaInsets();
  const feedback = useFeedback();

  const [customer, setCustomer] = useState<CustomerWithStats | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [months, setMonths] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [preview, setPreview] = useState<StatementPreview | null>(null);
  const [sharing, setSharing] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);

  const customers = useCustomers({ active: true });
  const previewMutation = usePreviewStatement();
  const sendMutation = useSendStatement();

  const availableMonths = useMemo(() => recentMonths(12), []);

  const toggleMonth = useCallback((key: string) => {
    setPreview(null);
    setMonths((prev) =>
      prev.includes(key) ? prev.filter((m) => m !== key) : [...prev, key].sort()
    );
  }, []);

  const handlePreview = useCallback(async () => {
    if (!customer || months.length === 0) return;
    try {
      setPreview(await previewMutation.mutateAsync({ customerId: customer.id, months }));
    } catch (e) {
      feedback.error(e);
    }
  }, [customer, months, previewMutation, feedback]);

  const handleShare = useCallback(async () => {
    if (!customer || months.length === 0) return;
    setSharing(true);
    try {
      await sharePdf(
        statementPdfPath(customer.id, months, notes.trim() || undefined),
        `bill-${customer.name.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase()}.pdf`,
        "Share or print this bill"
      );
    } catch (e) {
      feedback.error(e);
    } finally {
      setSharing(false);
    }
  }, [customer, months, notes, feedback]);

  const handleSend = useCallback(async () => {
    if (!customer || months.length === 0) return;
    setConfirmSend(false);
    try {
      await sendMutation.mutateAsync({
        customerId: customer.id,
        months,
        notes: notes.trim() || null,
      });
      feedback.success(`Bill sent to ${customer.name} on WhatsApp.`);
    } catch (e) {
      feedback.error(e);
    }
  }, [customer, months, notes, sendMutation, feedback]);

  const ready = customer !== null && months.length > 0;

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
      keyboardShouldPersistTaps="handled"
    >
      {/* 1 — who. */}
      <SectionCard title="Customer" icon="account-outline" padded={false}>
        <TouchableRipple onPress={() => setPickerOpen(true)}>
          <View style={styles.pickRow}>
            {customer ? (
              <>
                <CustomerAvatar name={customer.name} size={44} />
                <View style={styles.flex}>
                  <Text variant="bodyLarge" style={styles.semibold}>
                    {customer.name}
                  </Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    {customer.phoneNumber ?? "No phone number"}
                    {customer.pricePerLiter !== null
                      ? ` · ${formatCurrency(customer.pricePerLiter)}/L`
                      : ""}
                  </Text>
                </View>
              </>
            ) : (
              <>
                <View style={[styles.placeholder, { backgroundColor: theme.colors.surfaceVariant }]}>
                  <Icon source="account-question-outline" size={22} color={theme.colors.onSurfaceVariant} />
                </View>
                <Text variant="bodyLarge" style={styles.flex}>
                  Choose a customer
                </Text>
              </>
            )}
            <Icon source="chevron-right" size={22} color={theme.colors.onSurfaceVariant} />
          </View>
        </TouchableRipple>
      </SectionCard>

      {/* 2 — which months. */}
      <SectionCard
        title="Months to bill"
        subtitle={
          months.length === 0
            ? "Pick one or more"
            : `${months.length} selected · quantities come from daily entries`
        }
        icon="calendar-multiselect"
      >
        <View style={styles.monthGrid}>
          {availableMonths.map((key) => (
            <Chip
              key={key}
              selected={months.includes(key)}
              showSelectedCheck={false}
              onPress={() => toggleMonth(key)}
              style={
                months.includes(key)
                  ? { backgroundColor: theme.colors.secondaryContainer }
                  : undefined
              }
            >
              {formatMonthShort(key)}
            </Chip>
          ))}
        </View>
      </SectionCard>

      {/* 3 — check the numbers. */}
      <Button
        mode="contained-tonal"
        icon="calculator-variant-outline"
        onPress={handlePreview}
        loading={previewMutation.isPending}
        disabled={!ready || previewMutation.isPending}
        style={styles.action}
      >
        Work out the total
      </Button>

      {preview ? (
        <SectionCard title="Preview" icon="file-document-outline" padded={false}>
          {preview.months.map((month, index) => (
            <View key={month.key}>
              {index > 0 ? <Divider /> : null}
              <View style={styles.previewRow}>
                <View style={styles.flex}>
                  <Text variant="bodyMedium" style={styles.semibold}>
                    {formatMonth(month.key)}
                  </Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    {formatLiters(month.liters)} × {formatCurrency(month.pricePerLiter)}
                  </Text>
                </View>
                <View style={styles.previewAmount}>
                  <Money amount={month.amount} variant="titleSmall" />
                  {month.paid > 0.01 ? (
                    <Text variant="labelSmall" style={{ color: theme.dairy.paid.onContainer }}>
                      {formatCurrency(month.paid)} paid
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>
          ))}

          {preview.months.length > 0 ? <Divider /> : null}

          <View style={[styles.totalRow, { backgroundColor: theme.colors.surfaceVariant }]}>
            <View style={styles.flex}>
              <Text variant="titleSmall">Total due</Text>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                {formatLiters(preview.totals.liters)} · {formatCurrency(preview.totals.amount)} billed
                {preview.totals.paid > 0.01
                  ? ` · ${formatCurrency(preview.totals.paid)} received`
                  : ""}
              </Text>
            </View>
            <Money
              amount={preview.totals.due}
              tone={preview.totals.due > 0.01 ? "due" : "paid"}
              variant="titleLarge"
            />
          </View>

          {/* Months with no milk produce no bill — say so rather than showing ₹0. */}
          {preview.emptyMonths.length > 0 ? (
            <View style={[styles.emptyNote, { backgroundColor: theme.dairy.partial.container }]}>
              <Icon source="information-outline" size={16} color={theme.dairy.partial.onContainer} />
              <Text variant="bodySmall" style={{ color: theme.dairy.partial.onContainer, flex: 1 }}>
                No milk recorded in {preview.emptyMonths.map(formatMonthShort).join(", ")} — those
                months are not billed.
              </Text>
            </View>
          ) : null}
        </SectionCard>
      ) : null}

      {/* 4 — a note, then send. */}
      <SectionCard title="Note on the bill (optional)" icon="note-text-outline">
        <TextInput
          value={notes}
          onChangeText={setNotes}
          mode="outlined"
          multiline
          numberOfLines={3}
          placeholder="Anything you want printed on the bill"
        />
      </SectionCard>

      <View style={styles.actions}>
        <Button
          mode="contained-tonal"
          icon="share-variant-outline"
          onPress={handleShare}
          loading={sharing}
          disabled={!ready || sharing}
          style={styles.flex}
        >
          Print / share
        </Button>
        <Button
          mode="contained"
          icon="whatsapp"
          onPress={() => setConfirmSend(true)}
          loading={sendMutation.isPending}
          disabled={!ready || sendMutation.isPending || !customer?.phoneNumber}
          style={styles.flex}
        >
          Send
        </Button>
      </View>

      {customer && !customer.phoneNumber ? (
        <Text variant="bodySmall" style={{ color: theme.colors.error, textAlign: "center" }}>
          {customer.name} has no phone number, so this bill can only be printed or shared.
        </Text>
      ) : null}

      {/* Customer picker. */}
      <Portal>
        <CustomerPicker
          visible={pickerOpen}
          customers={customers.data ?? []}
          loading={customers.isLoading}
          onDismiss={() => setPickerOpen(false)}
          onSelect={(picked) => {
            setCustomer(picked);
            setPreview(null);
            setPickerOpen(false);
          }}
        />

        <Dialog visible={confirmSend} onDismiss={() => setConfirmSend(false)}>
          <Dialog.Icon icon="whatsapp" />
          <Dialog.Title style={styles.dialogTitle}>Send this bill?</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              {customer?.name} will receive a PDF covering{" "}
              {months.map(formatMonthShort).join(", ")}, with the caption in Hindi. Sending also
              creates the monthly bills if they do not exist yet.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setConfirmSend(false)}>Cancel</Button>
            <Button mode="contained" onPress={handleSend} loading={sendMutation.isPending}>
              Send
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}

function CustomerPicker({
  visible,
  customers,
  loading,
  onDismiss,
  onSelect,
}: {
  visible: boolean;
  customers: CustomerWithStats[];
  loading: boolean;
  onDismiss: () => void;
  onSelect: (customer: CustomerWithStats) => void;
}) {
  const theme = useTheme<AppTheme>();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return customers;
    return customers.filter(
      (c) => c.name.toLowerCase().includes(term) || (c.phoneNumber ?? "").includes(term)
    );
  }, [customers, search]);

  return (
    <Dialog visible={visible} onDismiss={onDismiss} style={styles.pickerDialog}>
      <Dialog.Title>Choose a customer</Dialog.Title>
      <Dialog.Content>
        <SearchField value={search} onChange={setSearch} placeholder="Search" />
      </Dialog.Content>
      <Dialog.ScrollArea style={styles.pickerScroll}>
        {loading ? (
          <CenteredLoader />
        ) : filtered.length === 0 ? (
          <EmptyState icon="account-search-outline" title="No customers found" />
        ) : (
          <ScrollView>
            {filtered.map((item, index) => (
              <View key={item.id}>
                {index > 0 ? <Divider /> : null}
                <TouchableRipple onPress={() => onSelect(item)}>
                  <View style={styles.pickerRow}>
                    <CustomerAvatar name={item.name} size={40} />
                    <View style={styles.flex}>
                      <Text variant="bodyLarge" numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                        {item.phoneNumber ?? "No phone number"}
                      </Text>
                    </View>
                    {item.stats.balance > 0.01 ? (
                      <Money amount={item.stats.balance} tone="due" variant="bodyMedium" />
                    ) : null}
                  </View>
                </TouchableRipple>
              </View>
            ))}
          </ScrollView>
        )}
      </Dialog.ScrollArea>
      <Dialog.Actions>
        <Button onPress={onDismiss}>Cancel</Button>
      </Dialog.Actions>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  semibold: { fontWeight: "600" },
  content: { padding: spacing.lg, gap: spacing.lg },
  pickRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg },
  placeholder: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  monthGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  action: { borderRadius: radius.full },
  actions: { flexDirection: "row", gap: spacing.md },
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  previewAmount: { alignItems: "flex-end" },
  totalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
  },
  emptyNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    margin: spacing.lg,
    borderRadius: radius.md,
  },
  dialogTitle: { textAlign: "center" },
  pickerDialog: { maxHeight: "85%" },
  pickerScroll: { paddingHorizontal: 0 },
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
});

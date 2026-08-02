import { useCallback, useMemo, useState } from "react";
import { FlatList, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import {
  Button,
  Chip,
  Dialog,
  HelperText,
  Icon,
  Portal,
  Switch,
  Text,
  TextInput,
  TouchableRipple,
  useTheme,
} from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useCustomerManager,
  useDeleteCollection,
  useRecordCollection,
  useSaveCustomerPatches,
  useSendReminder,
} from "@/hooks/queries";
import { useFeedback } from "@/components/feedback";
import { SearchField } from "@/components/navigators";
import { EmptyState, ErrorScreen, ListSkeleton } from "@/components/states";
import { CustomerAvatar, Divider, Money } from "@/components/ui";
import { radius, spacing } from "@/theme";
import type { AppTheme } from "@/theme";
import { today } from "@/utils/date";
import { displayPhone, formatCurrency, formatDate, formatRelative } from "@/utils/format";
import type { CollectionEntry, ManagedCustomer, PaymentStanding } from "@/api/types";

/**
 * Customer manager — the collections screen.
 *
 * This is where the farmer works out who to chase and records the cash they
 * take. The web version is a wide editable table; on a phone each customer is a
 * card, and tapping one opens the four things you would want to do with them:
 * collect, remind, edit, or read their ledger.
 *
 * Collection amounts are never allocated here — the amount is sent to the
 * server, which settles it oldest-bill-first and reports back which invoices it
 * cleared. Reproducing that split on the client would be a second, divergent
 * implementation of the one rule that decides who has been paid.
 */

type StandingFilter = "all" | "owing" | "settled" | "inactive";

const FILTERS: { value: StandingFilter; label: string; icon: string }[] = [
  { value: "all", label: "All", icon: "account-multiple-outline" },
  { value: "owing", label: "Owing", icon: "cash-clock" },
  { value: "settled", label: "Settled", icon: "check-circle-outline" },
  { value: "inactive", label: "Inactive", icon: "pause-circle-outline" },
];

const STANDING_LABELS: Record<PaymentStanding, string> = {
  NO_BILLS: "No bills",
  PAID: "Settled",
  PARTIAL: "Part paid",
  UNPAID: "Unpaid",
};

export default function CustomerManagerScreen() {
  const theme = useTheme<AppTheme>();
  const insets = useSafeAreaInsets();
  const feedback = useFeedback();

  const [filter, setFilter] = useState<StandingFilter>("owing");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ManagedCustomer | null>(null);
  const [sheet, setSheet] = useState<"actions" | "collect" | "edit" | "ledger" | null>(null);

  const { data, isLoading, isError, error, refetch, isRefetching } = useCustomerManager();
  const collect = useRecordCollection();
  const remind = useSendReminder();
  const savePatch = useSaveCustomerPatches();
  const deletePayment = useDeleteCollection(selected?.id ?? "");

  const rows = useMemo(() => {
    if (!data) return [];
    const term = search.trim().toLowerCase();

    return data.customers
      .filter((c) => {
        if (filter === "owing" && c.pendingAmount <= 0.01) return false;
        if (filter === "settled" && (c.pendingAmount > 0.01 || c.paymentStanding === "NO_BILLS")) {
          return false;
        }
        if (filter === "inactive" && c.isActive) return false;
        if (!term) return true;
        return c.name.toLowerCase().includes(term) || (c.phoneNumber ?? "").includes(term);
      })
      // Chase the oldest, largest debts first — that is the order the work
      // actually gets done in.
      .sort((a, b) => {
        if (filter === "owing") {
          const overdue = (b.daysOverdue ?? 0) - (a.daysOverdue ?? 0);
          if (overdue !== 0) return overdue;
          return b.pendingAmount - a.pendingAmount;
        }
        return a.name.localeCompare(b.name);
      });
  }, [data, filter, search]);

  const totalOwed = useMemo(
    () => data?.customers.reduce((sum, c) => sum + c.pendingAmount, 0) ?? 0,
    [data]
  );
  const owingCount = useMemo(
    () => data?.customers.filter((c) => c.pendingAmount > 0.01).length ?? 0,
    [data]
  );

  const close = useCallback(() => {
    setSheet(null);
    setSelected(null);
  }, []);

  const handleRemind = useCallback(
    async (customer: ManagedCustomer) => {
      setSheet(null);
      try {
        await remind.mutateAsync(customer.id);
        feedback.success(`Reminder sent to ${customer.name}.`);
      } catch (e) {
        feedback.error(e);
      }
      setSelected(null);
    },
    [remind, feedback]
  );

  const header = (
    <View style={styles.header}>
      <View style={[styles.summary, { backgroundColor: theme.dairy.due.container }]}>
        <View style={styles.flex}>
          <Text variant="labelMedium" style={{ color: theme.dairy.due.onContainer }}>
            TOTAL OUTSTANDING
          </Text>
          <Text
            variant="headlineSmall"
            style={{ color: theme.dairy.due.onContainer, fontWeight: "700" }}
          >
            {formatCurrency(totalOwed)}
          </Text>
          <Text variant="bodySmall" style={{ color: theme.dairy.due.onContainer }}>
            across {owingCount} customer{owingCount === 1 ? "" : "s"}
          </Text>
        </View>
        <Icon source="cash-clock" size={36} color={theme.dairy.due.onContainer} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {FILTERS.map((option) => (
          <Chip
            key={option.value}
            selected={filter === option.value}
            showSelectedCheck={false}
            icon={option.icon}
            onPress={() => setFilter(option.value)}
            style={
              filter === option.value
                ? { backgroundColor: theme.colors.secondaryContainer }
                : undefined
            }
          >
            {option.label}
          </Chip>
        ))}
      </ScrollView>

      <SearchField value={search} onChange={setSearch} placeholder="Search name or phone" />
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.fill}>
        {header}
        <ListSkeleton rows={6} />
      </View>
    );
  }

  if (isError || !data) return <ErrorScreen error={error} onRetry={() => void refetch()} />;

  return (
    <View style={[styles.fill, { backgroundColor: theme.colors.background }]}>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={header}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + spacing.xl }]}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />}
        ListEmptyComponent={
          <EmptyState
            icon={filter === "owing" ? "check-decagram-outline" : "account-search-outline"}
            title={
              search
                ? "No matches"
                : filter === "owing"
                  ? "Nobody owes anything"
                  : "No customers here"
            }
            description={
              search
                ? `Nothing matches "${search}".`
                : filter === "owing"
                  ? "Every bill has been settled."
                  : undefined
            }
          />
        }
        renderItem={({ item }) => (
          <ManagerRow
            customer={item}
            onPress={() => {
              setSelected(item);
              setSheet("actions");
            }}
          />
        )}
      />

      {/* What you can do with the customer you just tapped. */}
      <Portal>
        <Dialog visible={sheet === "actions" && selected !== null} onDismiss={close}>
          <Dialog.Title>{selected?.name}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={styles.dialogHint}>
              {selected && selected.pendingAmount > 0.01
                ? `${formatCurrency(selected.pendingAmount)} outstanding across ${selected.unpaidBills} bill${selected.unpaidBills === 1 ? "" : "s"}.`
                : "Nothing outstanding."}
            </Text>

            <View style={styles.sheetActions}>
              <Button
                mode="contained"
                icon="cash-plus"
                disabled={!selected || selected.pendingAmount <= 0.01}
                onPress={() => setSheet("collect")}
              >
                Record a collection
              </Button>
              <Button
                mode="contained-tonal"
                icon="whatsapp"
                loading={remind.isPending}
                disabled={
                  !selected ||
                  !selected.phoneNumber ||
                  selected.pendingAmount <= 0.01 ||
                  remind.isPending
                }
                onPress={() => selected && handleRemind(selected)}
              >
                Send WhatsApp reminder
              </Button>
              <Button mode="outlined" icon="pencil-outline" onPress={() => setSheet("edit")}>
                Quick edit
              </Button>
              <Button
                mode="outlined"
                icon="format-list-bulleted"
                onPress={() => setSheet("ledger")}
              >
                Payment ledger
              </Button>
              <Button
                icon="account-details-outline"
                onPress={() => {
                  const id = selected?.id;
                  close();
                  if (id) router.push(`/customer/${id}`);
                }}
              >
                Full profile
              </Button>
            </View>

            {selected && !selected.phoneNumber ? (
              <HelperText type="info" visible>
                No phone number saved, so reminders cannot be sent.
              </HelperText>
            ) : null}
            {selected?.lastRemindedAt ? (
              <HelperText type="info" visible>
                Last reminded {formatRelative(selected.lastRemindedAt)}.
              </HelperText>
            ) : null}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={close}>Close</Button>
          </Dialog.Actions>
        </Dialog>

        {/* Collect cash. */}
        <CollectDialog
          visible={sheet === "collect" && selected !== null}
          customer={selected}
          submitting={collect.isPending}
          onDismiss={() => setSheet("actions")}
          onSubmit={async (amount, paidOn, note) => {
            if (!selected) return;
            try {
              const result = await collect.mutateAsync({
                customerId: selected.id,
                amount,
                paidOn,
                note,
              });
              close();
              // Report what the money actually settled, as the web dialog does —
              // the farmer needs to be able to tell the customer.
              const invoices = result.allocations.map((a) => a.invoiceNumber).join(", ");
              feedback.success(
                `${formatCurrency(result.amount)} recorded against ${invoices}.` +
                  (result.remainingPending > 0.01
                    ? ` ${formatCurrency(result.remainingPending)} still due.`
                    : " Fully settled.")
              );
            } catch (e) {
              feedback.error(e);
            }
          }}
        />

        {/* Quick edit — the fields the web table lets you change inline. */}
        <QuickEditDialog
          visible={sheet === "edit" && selected !== null}
          customer={selected}
          globalRate={data.globalPricePerLiter}
          submitting={savePatch.isPending}
          onDismiss={() => setSheet("actions")}
          onSubmit={async (patch) => {
            if (!selected) return;
            try {
              await savePatch.mutateAsync([{ id: selected.id, ...patch }]);
              close();
              feedback.success("Changes saved.");
            } catch (e) {
              feedback.error(e);
            }
          }}
        />

        {/* Ledger. */}
        <LedgerDialog
          visible={sheet === "ledger" && selected !== null}
          customer={selected}
          entries={selected ? (data.collections[selected.id] ?? []) : []}
          deleting={deletePayment.isPending}
          onDismiss={() => setSheet("actions")}
          onDelete={async (paymentId) => {
            try {
              await deletePayment.mutateAsync(paymentId);
              feedback.success("Payment removed and the bill put back.");
            } catch (e) {
              feedback.error(e);
            }
          }}
        />
      </Portal>
    </View>
  );
}

function ManagerRow({
  customer,
  onPress,
}: {
  customer: ManagedCustomer;
  onPress: () => void;
}) {
  const theme = useTheme<AppTheme>();
  const owes = customer.pendingAmount > 0.01;

  const palette =
    customer.paymentStanding === "PAID"
      ? theme.dairy.paid
      : customer.paymentStanding === "PARTIAL"
        ? theme.dairy.partial
        : customer.paymentStanding === "UNPAID"
          ? theme.dairy.due
          : theme.dairy.pending;

  // A debt older than a month is the thing worth flagging, not the exact age.
  const stale = (customer.daysOverdue ?? 0) > 30;

  return (
    <TouchableRipple onPress={onPress} style={[styles.row, { backgroundColor: theme.colors.surface }]}>
      <View style={styles.rowInner}>
        <CustomerAvatar name={customer.name} size={44} />

        <View style={styles.flex}>
          <View style={styles.nameLine}>
            <Text variant="bodyLarge" numberOfLines={1} style={styles.semibold}>
              {customer.name}
            </Text>
            {!customer.isActive ? (
              <Icon source="pause-circle" size={14} color={theme.colors.onSurfaceVariant} />
            ) : null}
          </View>

          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {customer.phoneNumber ? displayPhone(customer.phoneNumber) : "No phone number"}
          </Text>

          <View style={styles.badges}>
            <View style={[styles.badge, { backgroundColor: palette.container }]}>
              <Text variant="labelSmall" style={{ color: palette.onContainer }}>
                {STANDING_LABELS[customer.paymentStanding]}
              </Text>
            </View>
            {owes && customer.daysOverdue !== null ? (
              <View
                style={[
                  styles.badge,
                  { backgroundColor: stale ? theme.colors.errorContainer : theme.colors.surfaceVariant },
                ]}
              >
                <Text
                  variant="labelSmall"
                  style={{
                    color: stale ? theme.colors.onErrorContainer : theme.colors.onSurfaceVariant,
                  }}
                >
                  {customer.daysOverdue}d overdue
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.rowRight}>
          {owes ? (
            <>
              <Money amount={customer.pendingAmount} tone="due" variant="titleSmall" />
              <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                {customer.unpaidBills} bill{customer.unpaidBills === 1 ? "" : "s"}
              </Text>
            </>
          ) : (
            <Icon source="check-circle" size={20} color={theme.dairy.paid.onContainer} />
          )}
        </View>
      </View>
    </TouchableRipple>
  );
}

function CollectDialog({
  visible,
  customer,
  submitting,
  onDismiss,
  onSubmit,
}: {
  visible: boolean;
  customer: ManagedCustomer | null;
  submitting: boolean;
  onDismiss: () => void;
  onSubmit: (amount: number, paidOn: string, note?: string) => Promise<void>;
}) {
  const due = customer?.pendingAmount ?? 0;
  const [amount, setAmount] = useState("");
  const [paidOn, setPaidOn] = useState(today());
  const [note, setNote] = useState("");

  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setAmount(due.toFixed(2));
      setPaidOn(today());
      setNote("");
    }
  }

  const parsed = parseFloat(amount);
  const invalid = Number.isNaN(parsed) || parsed <= 0;
  const overpay = !invalid && parsed - due > 0.01;

  return (
    <Dialog visible={visible} onDismiss={onDismiss}>
      <Dialog.Title>Record a collection</Dialog.Title>
      <Dialog.Content>
        <Text variant="bodySmall" style={styles.dialogHint}>
          {customer?.name} owes {formatCurrency(due)}. The amount is applied to their oldest unpaid
          bill first.
        </Text>

        <TextInput
          label="Amount received"
          value={amount}
          onChangeText={(text) => setAmount(text.replace(/[^0-9.]/g, ""))}
          mode="outlined"
          keyboardType="decimal-pad"
          left={<TextInput.Icon icon="currency-inr" />}
          error={overpay}
          autoFocus
        />
        <HelperText type={overpay ? "error" : "info"} visible>
          {overpay
            ? `That is more than the ${formatCurrency(due)} outstanding.`
            : "Change it if they paid only part."}
        </HelperText>

        <TextInput
          label="Received on"
          value={paidOn}
          onChangeText={setPaidOn}
          mode="outlined"
          placeholder="YYYY-MM-DD"
          left={<TextInput.Icon icon="calendar-outline" />}
        />

        <TextInput
          label="Note (optional)"
          value={note}
          onChangeText={setNote}
          mode="outlined"
          style={styles.spaced}
        />
      </Dialog.Content>
      <Dialog.Actions>
        <Button onPress={onDismiss}>Cancel</Button>
        <Button
          mode="contained"
          loading={submitting}
          disabled={invalid || overpay || submitting}
          onPress={() => void onSubmit(parsed, paidOn, note.trim() || undefined)}
        >
          Record
        </Button>
      </Dialog.Actions>
    </Dialog>
  );
}

function QuickEditDialog({
  visible,
  customer,
  globalRate,
  submitting,
  onDismiss,
  onSubmit,
}: {
  visible: boolean;
  customer: ManagedCustomer | null;
  globalRate: number;
  submitting: boolean;
  onDismiss: () => void;
  onSubmit: (patch: {
    name?: string;
    phoneNumber?: string | null;
    pricePerLiter?: string | null;
    isActive?: boolean;
  }) => Promise<void>;
}) {
  const theme = useTheme<AppTheme>();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [rate, setRate] = useState("");
  const [active, setActive] = useState(true);

  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible && customer) {
      setName(customer.name);
      setPhone(customer.phoneNumber ?? "");
      setRate(customer.pricePerLiter !== null ? String(customer.pricePerLiter) : "");
      setActive(customer.isActive);
    }
  }

  return (
    <Dialog visible={visible} onDismiss={onDismiss}>
      <Dialog.Title>Quick edit</Dialog.Title>
      <Dialog.Content>
        <TextInput label="Name" value={name} onChangeText={setName} mode="outlined" />
        <TextInput
          label="Phone"
          value={phone}
          onChangeText={setPhone}
          mode="outlined"
          keyboardType="phone-pad"
          style={styles.spaced}
        />
        <TextInput
          label="Rate per litre"
          value={rate}
          onChangeText={(text) => setRate(text.replace(/[^0-9.]/g, ""))}
          mode="outlined"
          keyboardType="decimal-pad"
          placeholder={String(globalRate)}
          style={styles.spaced}
        />
        <HelperText type="info" visible>
          Leave the rate blank to use the global ₹{globalRate}/L.
        </HelperText>

        <View style={styles.switchRow}>
          <View style={styles.flex}>
            <Text variant="bodyMedium">Active</Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              Inactive customers are excluded from daily entry and billing.
            </Text>
          </View>
          <Switch value={active} onValueChange={setActive} />
        </View>
      </Dialog.Content>
      <Dialog.Actions>
        <Button onPress={onDismiss}>Cancel</Button>
        <Button
          mode="contained"
          loading={submitting}
          disabled={submitting}
          onPress={() =>
            void onSubmit({
              name: name.trim(),
              // "" clears the number; the server maps an empty string to null.
              phoneNumber: phone.trim() || null,
              pricePerLiter: rate.trim() || null,
              isActive: active,
            })
          }
        >
          Save
        </Button>
      </Dialog.Actions>
    </Dialog>
  );
}

function LedgerDialog({
  visible,
  customer,
  entries,
  deleting,
  onDismiss,
  onDelete,
}: {
  visible: boolean;
  customer: ManagedCustomer | null;
  entries: CollectionEntry[];
  deleting: boolean;
  onDismiss: () => void;
  onDelete: (paymentId: string) => Promise<void>;
}) {
  const theme = useTheme<AppTheme>();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  return (
    <Dialog visible={visible} onDismiss={onDismiss} style={styles.ledgerDialog}>
      <Dialog.Title>{customer?.name}'s payments</Dialog.Title>
      <Dialog.ScrollArea style={styles.ledgerScroll}>
        {entries.length === 0 ? (
          <View style={styles.ledgerEmpty}>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              Nothing collected from this customer yet.
            </Text>
          </View>
        ) : (
          <ScrollView>
            {entries.map((entry, index) => (
              <View key={entry.id}>
                {index > 0 ? <Divider /> : null}
                <View style={styles.ledgerRow}>
                  <View style={styles.flex}>
                    <Text variant="bodyMedium" style={styles.semibold}>
                      {formatDate(entry.paidOn)}
                    </Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                      {entry.bill.invoiceNumber}
                      {entry.bill.stillDue > 0.01
                        ? ` · ${formatCurrency(entry.bill.stillDue)} still due`
                        : " · settled"}
                    </Text>
                    {entry.note ? (
                      <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                        {entry.note}
                      </Text>
                    ) : null}
                  </View>
                  <Money amount={entry.amount} tone="paid" variant="titleSmall" />
                  <Button
                    compact
                    textColor={theme.colors.error}
                    disabled={deleting}
                    onPress={() => setConfirmId(entry.id)}
                  >
                    Delete
                  </Button>
                </View>
              </View>
            ))}
          </ScrollView>
        )}
      </Dialog.ScrollArea>
      <Dialog.Actions>
        <Button onPress={onDismiss}>Close</Button>
      </Dialog.Actions>

      {/* Deleting a payment moves a bill back to unpaid, so it is confirmed. */}
      <Portal>
        <Dialog visible={confirmId !== null} onDismiss={() => setConfirmId(null)}>
          <Dialog.Icon icon="delete-outline" />
          <Dialog.Title style={styles.dialogTitle}>Remove this payment?</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              The bill it settled will go back to unpaid or part-paid. Use this only to correct a
              payment logged in error.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setConfirmId(null)}>Cancel</Button>
            <Button
              mode="contained"
              buttonColor={theme.colors.error}
              loading={deleting}
              onPress={async () => {
                const id = confirmId;
                setConfirmId(null);
                if (id) await onDelete(id);
              }}
            >
              Remove
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1 },
  semibold: { fontWeight: "600" },
  spaced: { marginTop: spacing.sm },
  header: { gap: spacing.md, padding: spacing.lg, paddingBottom: spacing.sm },
  summary: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
  },
  filters: { gap: spacing.sm, paddingRight: spacing.lg },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.sm },
  row: { borderRadius: radius.lg },
  rowInner: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md },
  nameLine: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  badges: { flexDirection: "row", gap: spacing.xs, marginTop: spacing.xs },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full },
  rowRight: { alignItems: "flex-end", gap: 2 },
  sheetActions: { gap: spacing.sm },
  dialogHint: { marginBottom: spacing.md },
  dialogTitle: { textAlign: "center" },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginTop: spacing.md,
  },
  ledgerDialog: { maxHeight: "80%" },
  ledgerScroll: { paddingHorizontal: 0 },
  ledgerEmpty: { padding: spacing.xl, alignItems: "center" },
  ledgerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
});

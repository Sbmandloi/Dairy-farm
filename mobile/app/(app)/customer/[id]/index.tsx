import { useEffect, useState } from "react";
import { Linking, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import {
  Button,
  Dialog,
  Icon,
  IconButton,
  Menu,
  Portal,
  Text,
  TouchableRipple,
  useTheme,
} from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useArchiveCustomer,
  useCustomer,
  useCustomerPayments,
  useRestoreCustomer,
  useToggleCustomerStatus,
} from "@/hooks/queries";
import { useFeedback } from "@/components/feedback";
import { CenteredLoader, EmptyState, ErrorScreen } from "@/components/states";
import {
  BillStatusChip,
  CustomerAvatar,
  DetailRow,
  Divider,
  Money,
  SectionCard,
  StatGrid,
  StatTile,
} from "@/components/ui";
import { radius, spacing } from "@/theme";
import type { AppTheme } from "@/theme";
import {
  displayPhone,
  formatCurrency,
  formatDate,
  formatLiters,
  formatPeriod,
} from "@/utils/format";

/**
 * Customer detail — everything known about one person.
 *
 * Ordered by how often it is needed: what they owe, how to contact them, their
 * bills, then their delivery history. Archiving is deliberately buried in the
 * overflow menu and confirmed, because it removes them from every working
 * screen — even though nothing is actually deleted.
 */
export default function CustomerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme<AppTheme>();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const feedback = useFeedback();

  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);

  const customer = useCustomer(id);
  const payments = useCustomerPayments(id);
  const archive = useArchiveCustomer();
  const restore = useRestoreCustomer();
  const toggleStatus = useToggleCustomerStatus();

  const data = customer.data;

  useEffect(() => {
    navigation.setOptions({ title: data?.name ?? "Customer" });
  }, [navigation, data?.name]);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
          <Menu
            visible={menuOpen}
            onDismiss={() => setMenuOpen(false)}
            anchor={
              <IconButton
                icon="dots-vertical"
                onPress={() => setMenuOpen(true)}
                accessibilityLabel="More actions"
              />
            }
          >
            <Menu.Item
              leadingIcon="pencil-outline"
              title="Edit details"
              onPress={() => {
                setMenuOpen(false);
                router.push(`/customer/${id}/edit`);
              }}
            />
            {data && !data.deletedAt ? (
              <Menu.Item
                leadingIcon={data.isActive ? "pause-circle-outline" : "play-circle-outline"}
                title={data.isActive ? "Mark inactive" : "Mark active"}
                onPress={async () => {
                  setMenuOpen(false);
                  try {
                    await toggleStatus.mutateAsync(id);
                    feedback.success(
                      data.isActive
                        ? `${data.name} is now inactive and won't appear in daily entry.`
                        : `${data.name} is active again.`
                    );
                  } catch (e) {
                    feedback.error(e);
                  }
                }}
              />
            ) : null}
            {data?.deletedAt ? (
              <Menu.Item
                leadingIcon="restore"
                title="Restore customer"
                onPress={async () => {
                  setMenuOpen(false);
                  try {
                    await restore.mutateAsync(id);
                    feedback.success(`${data.name} restored, with all their history.`);
                  } catch (e) {
                    feedback.error(e);
                  }
                }}
              />
            ) : (
              <Menu.Item
                leadingIcon="archive-outline"
                title="Archive customer"
                onPress={() => {
                  setMenuOpen(false);
                  setConfirmArchive(true);
                }}
              />
            )}
          </Menu>
      ),
    });
  }, [navigation, menuOpen, data, id, toggleStatus, restore, feedback]);

  if (customer.isLoading) return <CenteredLoader label="Loading customer…" />;
  if (customer.isError || !data) {
    return <ErrorScreen error={customer.error} onRetry={() => void customer.refetch()} />;
  }

  const totals = payments.data?.totals;
  const owes = (totals?.totalPending ?? 0) > 0.01;

  const call = () => {
    if (data.phoneNumber) void Linking.openURL(`tel:${data.phoneNumber}`);
  };
  const whatsapp = () => {
    if (data.phoneNumber) {
      void Linking.openURL(`https://wa.me/${data.phoneNumber.replace(/\D/g, "")}`);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
      refreshControl={
        <RefreshControl
          refreshing={customer.isRefetching || payments.isRefetching}
          onRefresh={() => {
            void customer.refetch();
            void payments.refetch();
          }}
        />
      }
    >
      {data.deletedAt ? (
        <View style={[styles.banner, { backgroundColor: theme.colors.errorContainer }]}>
          <Icon source="archive" size={18} color={theme.colors.onErrorContainer} />
          <Text variant="bodySmall" style={{ color: theme.colors.onErrorContainer, flex: 1 }}>
            Archived. All history is kept and can be restored from the menu above.
          </Text>
        </View>
      ) : null}

      {/* Identity + the two things you do with a phone number. */}
      <SectionCard>
        <View style={styles.identity}>
          <CustomerAvatar name={data.name} size={64} />
          <View style={styles.flex}>
            <Text variant="titleLarge" numberOfLines={2}>
              {data.name}
            </Text>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              {data.phoneNumber ? displayPhone(data.phoneNumber) : "No phone number"}
            </Text>
            {!data.isActive && !data.deletedAt ? (
              <Text variant="labelSmall" style={{ color: theme.colors.error }}>
                Inactive — excluded from daily entry and billing
              </Text>
            ) : null}
          </View>
        </View>

        {data.phoneNumber ? (
          <View style={styles.contactRow}>
            <Button mode="contained-tonal" icon="phone" onPress={call} style={styles.flex}>
              Call
            </Button>
            <Button mode="contained-tonal" icon="whatsapp" onPress={whatsapp} style={styles.flex}>
              WhatsApp
            </Button>
          </View>
        ) : (
          <View style={[styles.banner, { backgroundColor: theme.dairy.partial.container }]}>
            <Icon source="phone-off-outline" size={16} color={theme.dairy.partial.onContainer} />
            <Text variant="bodySmall" style={{ color: theme.dairy.partial.onContainer, flex: 1 }}>
              Add a phone number to send bills and reminders on WhatsApp.
            </Text>
          </View>
        )}
      </SectionCard>

      {/* Money. */}
      <StatGrid>
        <StatTile
          label="Billed"
          value={formatCurrency(totals?.totalBilled ?? 0)}
          caption="all time"
          icon="receipt"
          palette={theme.dairy.billed}
          style={styles.halfTile}
        />
        <StatTile
          label="Collected"
          value={formatCurrency(totals?.totalPaid ?? 0)}
          caption={`${payments.data?.payments.length ?? 0} payments`}
          icon="check-circle-outline"
          palette={theme.dairy.paid}
          style={styles.halfTile}
        />
        <StatTile
          label="Outstanding"
          value={formatCurrency(Math.max(0, totals?.totalPending ?? 0))}
          caption={
            owes
              ? `${totals?.unpaidBills ?? 0} unpaid bill${totals?.unpaidBills === 1 ? "" : "s"}`
              : "all settled"
          }
          icon="alert-circle-outline"
          palette={owes ? theme.dairy.due : theme.dairy.settled}
          style={styles.halfTile}
        />
        <StatTile
          label="Rate"
          value={`${formatCurrency(data.pricePerLiter ?? 0)}/L`}
          caption={data.pricePerLiter !== null ? "custom rate" : "uses global rate"}
          icon="tag-outline"
          palette={theme.dairy.milk}
          style={styles.halfTile}
        />
      </StatGrid>

      {owes ? (
        <Button
          mode="contained"
          icon="cash-plus"
          onPress={() => router.push("/manager")}
          style={styles.collect}
        >
          Record a collection
        </Button>
      ) : null}

      {/* Details. */}
      <SectionCard title="Details" icon="information-outline">
        <DetailRow label="Started" value={formatDate(data.startDate)} icon="calendar-start" />
        <Divider />
        <DetailRow label="Address" value={data.address || "—"} icon="map-marker-outline" />
        <Divider />
        <DetailRow
          label="Status"
          value={data.deletedAt ? "Archived" : data.isActive ? "Active" : "Inactive"}
          icon="account-check-outline"
        />
      </SectionCard>

      {/* Bills. */}
      <SectionCard
        title="Recent bills"
        subtitle={data.bills.length === 0 ? "None yet" : `${data.bills.length} most recent`}
        icon="receipt-text-outline"
        padded={false}
      >
        {data.bills.length === 0 ? (
          <EmptyState
            icon="receipt-text-outline"
            title="No bills yet"
            description="Bills appear here once a month's milk has been billed."
          />
        ) : (
          data.bills.map((bill, index) => (
            <View key={bill.id}>
              {index > 0 ? <Divider /> : null}
              <TouchableRipple onPress={() => router.push(`/bill/${bill.id}`)}>
                <View style={styles.billRow}>
                  <View style={styles.flex}>
                    <Text variant="bodyMedium" style={styles.semibold}>
                      {bill.invoiceNumber}
                    </Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                      {formatPeriod(bill.periodStart, bill.periodEnd)}
                    </Text>
                    <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                      {formatLiters(bill.totalLiters)}
                    </Text>
                  </View>
                  <View style={styles.billRight}>
                    <Money
                      amount={bill.due > 0.01 ? bill.due : bill.totalAmount}
                      tone={bill.due > 0.01 ? "due" : "paid"}
                      variant="titleSmall"
                    />
                    <BillStatusChip status={bill.status} compact />
                  </View>
                </View>
              </TouchableRipple>
            </View>
          ))
        )}
      </SectionCard>

      {/* Payment ledger. */}
      <SectionCard
        title="Payment history"
        subtitle={
          payments.data && payments.data.payments.length > 0
            ? `${payments.data.payments.length} payments recorded`
            : "Nothing collected yet"
        }
        icon="cash-multiple"
        padded={false}
      >
        {!payments.data || payments.data.payments.length === 0 ? (
          <EmptyState
            icon="cash-remove"
            title="No payments yet"
            description="Collections recorded against this customer appear here."
          />
        ) : (
          payments.data.payments.slice(0, 12).map((payment, index) => (
            <View key={payment.id}>
              {index > 0 ? <Divider /> : null}
              <View style={styles.paymentRow}>
                <View style={[styles.paymentIcon, { backgroundColor: theme.dairy.paid.container }]}>
                  <Icon source="arrow-down" size={16} color={theme.dairy.paid.onContainer} />
                </View>
                <View style={styles.flex}>
                  <Text variant="bodyMedium">{formatDate(payment.paidOn)}</Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    Against {payment.bill.invoiceNumber}
                  </Text>
                  {payment.note ? (
                    <Text
                      variant="labelSmall"
                      numberOfLines={2}
                      style={{ color: theme.colors.onSurfaceVariant }}
                    >
                      {payment.note}
                    </Text>
                  ) : null}
                </View>
                <Money amount={payment.amountPaid} tone="paid" variant="titleSmall" />
              </View>
            </View>
          ))
        )}
      </SectionCard>

      {/* Delivery history. */}
      <SectionCard
        title="Recent deliveries"
        subtitle={`${data.dailyEntries.length} most recent`}
        icon="clipboard-text-clock-outline"
        padded={false}
      >
        {data.dailyEntries.length === 0 ? (
          <EmptyState
            icon="water-off-outline"
            title="No deliveries recorded"
            description="Daily entries for this customer appear here."
          />
        ) : (
          data.dailyEntries.slice(0, 15).map((entry, index) =>
            entry ? (
              <View key={entry.id}>
                {index > 0 ? <Divider /> : null}
                <View style={styles.entryRow}>
                  <Text variant="bodyMedium" style={styles.flex}>
                    {formatDate(entry.date)}
                  </Text>
                  {entry.morningLiters !== null || entry.eveningLiters !== null ? (
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                      M {entry.morningLiters ?? 0} · E {entry.eveningLiters ?? 0}
                    </Text>
                  ) : null}
                  <Text variant="bodyMedium" style={styles.semibold}>
                    {formatLiters(entry.totalLiters)}
                  </Text>
                </View>
              </View>
            ) : null
          )
        )}
      </SectionCard>

      <Portal>
        <Dialog visible={confirmArchive} onDismiss={() => setConfirmArchive(false)}>
          <Dialog.Icon icon="archive-outline" />
          <Dialog.Title style={styles.dialogTitle}>Archive {data.name}?</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              They will be hidden from daily entry, billing, reports and the dashboard. Nothing is
              deleted — every bill, payment and delivery is kept, and you can restore them at any
              time.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setConfirmArchive(false)}>Cancel</Button>
            <Button
              mode="contained"
              loading={archive.isPending}
              onPress={async () => {
                setConfirmArchive(false);
                try {
                  await archive.mutateAsync(id);
                  feedback.success(`${data.name} archived. Their history is kept.`);
                  router.back();
                } catch (e) {
                  feedback.error(e);
                }
              }}
            >
              Archive
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  semibold: { fontWeight: "600" },
  content: { padding: spacing.lg, gap: spacing.lg },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  identity: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  contactRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg },
  halfTile: { width: "48%", flexGrow: 1 },
  collect: { borderRadius: radius.full },
  billRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
  },
  billRight: { alignItems: "flex-end", gap: spacing.xs },
  paymentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
  },
  paymentIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  entryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  dialogTitle: { textAlign: "center" },
});

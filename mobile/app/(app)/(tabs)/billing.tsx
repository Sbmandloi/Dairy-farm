import { useCallback, useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import {
  Button,
  Dialog,
  Divider as PaperDivider,
  Icon,
  Menu,
  Portal,
  Text,
  TouchableRipple,
  useTheme,
} from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBilling, useGenerateBills, useSendAllBills } from "@/hooks/queries";
import { monthPdfPath } from "@/api/endpoints";
import { sharePdf } from "@/utils/download";
import { useFeedback } from "@/components/feedback";
import { MonthNavigator, SearchField } from "@/components/navigators";
import { EmptyState, ErrorScreen, ListSkeleton, StatsSkeleton } from "@/components/states";
import { BillStatusChip, CustomerAvatar, Money, StatGrid, StatTile } from "@/components/ui";
import { radius, spacing } from "@/theme";
import type { AppTheme } from "@/theme";
import { currentYearMonth } from "@/utils/date";
import { formatCurrency, formatLiters } from "@/utils/format";
import type { SendAllResult } from "@/api/types";

/**
 * Billing — generate a month's bills, then print or send them.
 *
 * The three bulk actions the web puts in a toolbar (generate, print all, send
 * all) are the primary controls here too, but each one states its consequence
 * before running: sending a month of invoices to real customers over WhatsApp
 * is not an action to take by accident on a phone in a pocket.
 */
export default function BillingScreen() {
  const theme = useTheme<AppTheme>();
  const insets = useSafeAreaInsets();
  const feedback = useFeedback();

  const [period, setPeriod] = useState(currentYearMonth());
  const [search, setSearch] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);
  const [sendReport, setSendReport] = useState<SendAllResult | null>(null);
  const [printing, setPrinting] = useState(false);

  const { data, isLoading, isError, error, refetch, isRefetching } = useBilling(
    period.year,
    period.month
  );
  const generate = useGenerateBills();
  const sendAll = useSendAllBills();

  const rows = useMemo(() => {
    if (!data) return [];
    const query = search.trim().toLowerCase();
    if (!query) return data.rows;
    return data.rows.filter(
      (row) =>
        row.customer.name.toLowerCase().includes(query) ||
        row.bill?.invoiceNumber.toLowerCase().includes(query)
    );
  }, [data, search]);

  const handleGenerate = useCallback(async () => {
    if (!data) return;
    setMenuOpen(false);
    try {
      const bills = await generate.mutateAsync({
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
      });
      feedback.success(
        bills.length === 0
          ? "No milk entries this month, so there was nothing to bill."
          : `Generated ${bills.length} bill${bills.length === 1 ? "" : "s"}.`
      );
    } catch (e) {
      feedback.error(e);
    }
  }, [data, generate, feedback]);

  const handlePrintAll = useCallback(async () => {
    setMenuOpen(false);
    setPrinting(true);
    try {
      await sharePdf(
        monthPdfPath(period.year, period.month),
        `bills-${period.year}-${String(period.month).padStart(2, "0")}.pdf`,
        "Share or print this month's bills"
      );
    } catch (e) {
      feedback.error(e);
    } finally {
      setPrinting(false);
    }
  }, [period, feedback]);

  const handleSendAll = useCallback(async () => {
    if (!data) return;
    setConfirmSend(false);
    try {
      const result = await sendAll.mutateAsync({
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
      });
      // Always show the breakdown: a partial success is the normal outcome when
      // one customer's number is wrong, and "sent" alone would hide that.
      setSendReport(result);
      if (result.failed === 0 && result.sent > 0) {
        feedback.success(`Sent ${result.sent} bills on WhatsApp.`);
      }
    } catch (e) {
      feedback.error(e);
    }
  }, [data, sendAll, feedback]);

  const header = data ? (
    <View style={styles.header}>
      <MonthNavigator
        year={period.year}
        month={period.month}
        onChange={setPeriod}
        allowFuture={false}
      />

      <StatGrid>
        <StatTile
          label="Billed"
          value={formatCurrency(data.summary.totalAmount)}
          caption={`${data.summary.billCount} bill${data.summary.billCount === 1 ? "" : "s"}`}
          icon="receipt"
          palette={theme.dairy.billed}
          style={styles.halfTile}
        />
        <StatTile
          label="Quantity"
          value={formatLiters(data.summary.totalLiters)}
          caption="this month"
          icon="water-outline"
          palette={theme.dairy.milk}
          style={styles.halfTile}
        />
        <StatTile
          label="Collected"
          value={formatCurrency(data.summary.totalPaid)}
          caption="payments received"
          icon="check-circle-outline"
          palette={theme.dairy.paid}
          style={styles.halfTile}
        />
        <StatTile
          label="Outstanding"
          value={formatCurrency(data.summary.outstanding)}
          caption={data.summary.outstanding > 0.01 ? "still to collect" : "all settled"}
          icon="alert-circle-outline"
          palette={data.summary.outstanding > 0.01 ? theme.dairy.due : theme.dairy.settled}
          style={styles.halfTile}
        />
      </StatGrid>

      <View style={styles.actions}>
        <Button
          mode="contained"
          icon="file-document-multiple-outline"
          onPress={handleGenerate}
          loading={generate.isPending}
          disabled={generate.isPending}
          style={styles.flex}
        >
          Generate bills
        </Button>

        <Menu
          visible={menuOpen}
          onDismiss={() => setMenuOpen(false)}
          anchor={
            <Button mode="contained-tonal" icon="dots-horizontal" onPress={() => setMenuOpen(true)}>
              More
            </Button>
          }
        >
          <Menu.Item
            leadingIcon="printer-outline"
            title="Print / share all"
            disabled={data.summary.billCount === 0 || printing}
            onPress={handlePrintAll}
          />
          <Menu.Item
            leadingIcon="whatsapp"
            title={`Send all on WhatsApp (${data.summary.sendableCount})`}
            disabled={data.summary.sendableCount === 0}
            onPress={() => {
              setMenuOpen(false);
              setConfirmSend(true);
            }}
          />
        </Menu>
      </View>

      {data.summary.withoutBill > 0 ? (
        <View style={[styles.notice, { backgroundColor: theme.dairy.pending.container }]}>
          <Icon source="information-outline" size={18} color={theme.dairy.pending.onContainer} />
          <Text variant="bodySmall" style={{ color: theme.dairy.pending.onContainer, flex: 1 }}>
            {data.summary.withoutBill} customer
            {data.summary.withoutBill === 1 ? " has" : "s have"} no bill this month — usually because
            no milk was recorded for them.
          </Text>
        </View>
      ) : null}

      {data.rows.length > 6 ? (
        <SearchField value={search} onChange={setSearch} placeholder="Search name or invoice" />
      ) : null}
    </View>
  ) : null;

  if (isLoading) {
    return (
      <View style={styles.fill}>
        <View style={styles.header}>
          <MonthNavigator year={period.year} month={period.month} onChange={setPeriod} />
          <StatsSkeleton />
        </View>
        <ListSkeleton rows={5} />
      </View>
    );
  }

  if (isError || !data) return <ErrorScreen error={error} onRetry={() => void refetch()} />;

  return (
    <View style={[styles.fill, { backgroundColor: theme.colors.background }]}>
      <FlatList
        data={rows}
        keyExtractor={(row) => row.customer.id}
        ListHeaderComponent={header}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + spacing.xl }]}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />}
        ListEmptyComponent={
          <EmptyState
            icon="receipt-text-outline"
            title={search ? "No matches" : "Nothing to bill yet"}
            description={
              search
                ? `Nothing matches "${search}".`
                : "Record daily milk entries first, then generate this month's bills."
            }
          />
        }
        renderItem={({ item }) => (
          <TouchableRipple
            onPress={() => item.bill && router.push(`/bill/${item.bill.id}`)}
            disabled={!item.bill}
            style={[styles.row, { backgroundColor: theme.colors.surface }]}
          >
            <View style={styles.rowInner}>
              <CustomerAvatar name={item.customer.name} size={42} />

              <View style={styles.flex}>
                <Text variant="bodyLarge" numberOfLines={1} style={styles.semibold}>
                  {item.customer.name}
                </Text>
                {item.bill ? (
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    {item.bill.invoiceNumber} · {formatLiters(item.bill.totalLiters)}
                  </Text>
                ) : (
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    No bill this month
                  </Text>
                )}
              </View>

              {item.bill ? (
                <View style={styles.rowRight}>
                  <Money
                    amount={item.bill.due > 0.01 ? item.bill.due : item.bill.totalAmount}
                    tone={item.bill.due > 0.01 ? "due" : "paid"}
                    variant="titleSmall"
                  />
                  <BillStatusChip status={item.bill.status} compact />
                </View>
              ) : (
                <Icon source="minus" size={18} color={theme.colors.onSurfaceVariant} />
              )}
            </View>
          </TouchableRipple>
        )}
      />

      {/* Bulk WhatsApp send: state the count and that it cannot be undone. */}
      <Portal>
        <Dialog visible={confirmSend} onDismiss={() => setConfirmSend(false)}>
          <Dialog.Icon icon="whatsapp" />
          <Dialog.Title style={styles.dialogTitle}>Send bills on WhatsApp?</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              This will send a PDF invoice to {data.summary.sendableCount} customer
              {data.summary.sendableCount === 1 ? "" : "s"} who still owe money and have a phone
              number saved. Messages cannot be recalled once sent.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setConfirmSend(false)}>Cancel</Button>
            <Button mode="contained" onPress={handleSendAll} loading={sendAll.isPending}>
              Send {data.summary.sendableCount}
            </Button>
          </Dialog.Actions>
        </Dialog>

        {/* Per-customer outcome, because a partial failure is normal. */}
        <Dialog
          visible={sendReport !== null}
          onDismiss={() => setSendReport(null)}
          style={styles.reportDialog}
        >
          <Dialog.Title>
            {sendReport?.failed === 0 ? "All bills sent" : "Sending finished"}
          </Dialog.Title>
          <Dialog.ScrollArea style={styles.reportScroll}>
            <FlatList
              data={sendReport?.results ?? []}
              keyExtractor={(r) => r.billId}
              ItemSeparatorComponent={PaperDivider}
              renderItem={({ item }) => (
                <View style={styles.reportRow}>
                  <Icon
                    source={item.success ? "check-circle" : "alert-circle"}
                    size={18}
                    color={
                      item.success ? theme.dairy.paid.onContainer : theme.colors.error
                    }
                  />
                  <View style={styles.flex}>
                    <Text variant="bodyMedium">{item.customerName}</Text>
                    {item.error ? (
                      <Text variant="bodySmall" style={{ color: theme.colors.error }}>
                        {item.error}
                      </Text>
                    ) : null}
                  </View>
                </View>
              )}
            />
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setSendReport(null)}>Close</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1 },
  semibold: { fontWeight: "600" },
  header: { gap: spacing.md, paddingBottom: spacing.md },
  halfTile: { width: "48%", flexGrow: 1 },
  actions: { flexDirection: "row", gap: spacing.sm, alignItems: "center" },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  list: { padding: spacing.lg, gap: spacing.sm },
  row: { borderRadius: radius.lg },
  rowInner: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md },
  rowRight: { alignItems: "flex-end", gap: spacing.xs },
  dialogTitle: { textAlign: "center" },
  reportDialog: { maxHeight: "75%" },
  reportScroll: { paddingHorizontal: 0 },
  reportRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
});

import { useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import {
  Button,
  Chip,
  Icon,
  SegmentedButtons,
  Text,
  TouchableRipple,
  useTheme,
} from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useReports } from "@/hooks/queries";
import { exportPath } from "@/api/endpoints";
import { shareCsv, shareJson } from "@/utils/download";
import { useFeedback } from "@/components/feedback";
import { CenteredLoader, EmptyState, ErrorScreen } from "@/components/states";
import { Divider, Money, SectionCard, StatGrid, StatTile } from "@/components/ui";
import { radius, spacing } from "@/theme";
import type { AppTheme } from "@/theme";
import { recentMonths } from "@/utils/date";
import {
  formatCurrency,
  formatDate,
  formatLiters,
  formatMonth,
  formatMonthShort,
  formatRelative,
} from "@/utils/format";

/**
 * Reports and backup.
 *
 * The web page is four tabs of tables. Here the all-time figures stay pinned at
 * the top — they are what gets glanced at — and the four views live behind a
 * segmented control. The monthly summary gains a bar chart, because a trend is
 * the one thing a table of twelve rows communicates badly on a small screen.
 */

type Tab = "months" | "top" | "payments" | "backup";

export default function ReportsScreen() {
  const theme = useTheme<AppTheme>();
  const insets = useSafeAreaInsets();

  const [tab, setTab] = useState<Tab>("months");
  const { data, isLoading, isError, error, refetch, isRefetching } = useReports();

  if (isLoading) return <CenteredLoader label="Loading reports…" />;
  if (isError || !data) return <ErrorScreen error={error} onRetry={() => void refetch()} />;

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />}
    >
      <StatGrid>
        <StatTile
          label="Total billed"
          value={formatCurrency(data.allTime.totalBilled)}
          caption={`${data.allTime.totalBills} bills`}
          icon="receipt"
          palette={theme.dairy.billed}
          style={styles.halfTile}
        />
        <StatTile
          label="Collected"
          value={formatCurrency(data.allTime.totalCollected)}
          caption="all time"
          icon="check-circle-outline"
          palette={theme.dairy.paid}
          style={styles.halfTile}
        />
        <StatTile
          label="Outstanding"
          value={formatCurrency(data.allTime.outstanding)}
          caption={data.allTime.outstanding > 0.01 ? "still to collect" : "all settled"}
          icon="alert-circle-outline"
          palette={data.allTime.outstanding > 0.01 ? theme.dairy.due : theme.dairy.settled}
          style={styles.halfTile}
        />
        <StatTile
          label="Total milk"
          value={formatLiters(data.allTime.totalLiters)}
          caption="all time"
          icon="water-outline"
          palette={theme.dairy.milk}
          style={styles.halfTile}
        />
      </StatGrid>

      <SegmentedButtons
        value={tab}
        onValueChange={(value) => setTab(value as Tab)}
        density="small"
        buttons={[
          { value: "months", label: "Months", icon: "chart-bar" },
          { value: "top", label: "Top", icon: "trophy-outline" },
          { value: "payments", label: "Paid", icon: "cash" },
          { value: "backup", label: "Backup", icon: "cloud-download-outline" },
        ]}
      />

      {tab === "months" ? <MonthlyTab data={data} /> : null}
      {tab === "top" ? <TopCustomersTab data={data} /> : null}
      {tab === "payments" ? <PaymentsTab data={data} /> : null}
      {tab === "backup" ? <BackupTab lastBackupAt={data.lastBackupAt} /> : null}
    </ScrollView>
  );
}

type ReportData = NonNullable<ReturnType<typeof useReports>["data"]>;

function MonthlyTab({ data }: { data: ReportData }) {
  const theme = useTheme<AppTheme>();
  // Oldest first reads as a trend; the API returns newest first for tables.
  const rows = useMemo(() => [...data.monthlySummary].reverse(), [data.monthlySummary]);
  const peak = Math.max(1, ...rows.map((row) => row.amount));

  if (rows.length === 0) {
    return (
      <SectionCard>
        <EmptyState
          icon="chart-bar"
          title="No billing history yet"
          description="Generate bills to see monthly trends here."
        />
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Last 12 months" icon="chart-bar" padded={false}>
      {/* Bars are proportional to the largest month, so the shape of the year
          is readable without axis labels stealing space. */}
      <View style={styles.chart}>
        {rows.map((row) => (
          <View key={row.periodStart} style={styles.barColumn}>
            <View
              style={[
                styles.bar,
                {
                  height: Math.max(4, (row.amount / peak) * 96),
                  backgroundColor: theme.colors.primary,
                },
              ]}
            />
            <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {formatMonthShort(row.periodStart).slice(0, 3)}
            </Text>
          </View>
        ))}
      </View>

      <Divider />

      {[...rows].reverse().map((row, index) => (
        <View key={row.periodStart}>
          {index > 0 ? <Divider /> : null}
          <TouchableRipple onPress={() => router.push("/billing")}>
            <View style={styles.tableRow}>
              <View style={styles.flex}>
                <Text variant="bodyMedium" style={styles.semibold}>
                  {formatMonth(row.periodStart)}
                </Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  {row.bills} bill{row.bills === 1 ? "" : "s"} · {formatLiters(row.liters)}
                </Text>
              </View>
              <Money amount={row.amount} variant="titleSmall" />
            </View>
          </TouchableRipple>
        </View>
      ))}
    </SectionCard>
  );
}

function TopCustomersTab({ data }: { data: ReportData }) {
  const theme = useTheme<AppTheme>();

  const medal = (rank: number) =>
    rank === 0
      ? theme.dairy.partial
      : rank === 1
        ? theme.dairy.pending
        : rank === 2
          ? theme.dairy.due
          : { container: theme.colors.surfaceVariant, onContainer: theme.colors.onSurfaceVariant };

  return (
    <SectionCard
      title={`Top customers — ${formatMonth(data.currentMonth)}`}
      icon="trophy-outline"
      padded={false}
    >
      {data.topCustomers.length === 0 ? (
        <EmptyState
          icon="trophy-outline"
          title="No entries this month"
          description="Record daily milk to see who your biggest customers are."
        />
      ) : (
        data.topCustomers.map((row, index) => {
          const palette = medal(index);
          return (
            <View key={row.customerId}>
              {index > 0 ? <Divider /> : null}
              <TouchableRipple onPress={() => router.push(`/customer/${row.customerId}`)}>
                <View style={styles.tableRow}>
                  <View style={[styles.rank, { backgroundColor: palette.container }]}>
                    <Text variant="labelMedium" style={{ color: palette.onContainer, fontWeight: "700" }}>
                      {index + 1}
                    </Text>
                  </View>
                  <Text variant="bodyMedium" numberOfLines={1} style={styles.flex}>
                    {row.name}
                  </Text>
                  <Text variant="titleSmall" style={{ color: theme.colors.primary, fontWeight: "700" }}>
                    {formatLiters(row.liters)}
                  </Text>
                </View>
              </TouchableRipple>
            </View>
          );
        })
      )}
    </SectionCard>
  );
}

function PaymentsTab({ data }: { data: ReportData }) {
  const theme = useTheme<AppTheme>();

  return (
    <SectionCard title="Recent payments" icon="cash-multiple" padded={false}>
      {data.recentPayments.length === 0 ? (
        <EmptyState
          icon="cash-remove"
          title="No payments recorded"
          description="Collections appear here as you record them."
        />
      ) : (
        data.recentPayments.map((payment, index) => (
          <View key={payment.id}>
            {index > 0 ? <Divider /> : null}
            <TouchableRipple onPress={() => router.push(`/bill/${payment.billId}`)}>
              <View style={styles.tableRow}>
                <View style={styles.flex}>
                  <Text variant="bodyMedium" style={styles.semibold}>
                    {payment.customerName}
                  </Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    {payment.invoiceNumber} · {formatDate(payment.paidOn)}
                  </Text>
                </View>
                <Money amount={payment.amount} tone="paid" variant="titleSmall" />
              </View>
            </TouchableRipple>
          </View>
        ))
      )}
    </SectionCard>
  );
}

/**
 * Backup and export.
 *
 * Only the JSON snapshot is a real backup — it is the only export that can
 * rebuild the database — so it is the primary action and the only one whose age
 * is tracked. The CSVs are reports, and are labelled as such rather than being
 * allowed to look like protection they do not provide.
 */
function BackupTab({ lastBackupAt }: { lastBackupAt: string | null }) {
  const theme = useTheme<AppTheme>();
  const feedback = useFeedback();
  const [busy, setBusy] = useState<string | null>(null);
  const [period, setPeriod] = useState<string>("all");

  const months = useMemo(() => recentMonths(12), []);

  // Captured once when the tab mounts. Reading the clock during every render
  // would be impure, and a staleness badge has no reason to tick.
  const [mountedAt] = useState(() => Date.now());

  const staleness = useMemo(() => {
    if (!lastBackupAt) return { tone: "error" as const, text: "Never backed up" };

    const days = (mountedAt - new Date(lastBackupAt).getTime()) / 86_400_000;
    const text = `Last backup ${formatRelative(lastBackupAt)}`;

    // A month-old off-site copy is a real risk to the dairy's records; a week
    // is worth mentioning but not alarming about.
    if (days > 30) return { tone: "error" as const, text };
    if (days > 7) return { tone: "warn" as const, text };
    return { tone: "ok" as const, text: `Backed up ${formatRelative(lastBackupAt)}` };
  }, [lastBackupAt, mountedAt]);

  const palette =
    staleness.tone === "error"
      ? { container: theme.colors.errorContainer, onContainer: theme.colors.onErrorContainer }
      : staleness.tone === "warn"
        ? theme.dairy.partial
        : theme.dairy.paid;

  async function run(key: string, action: () => Promise<void>) {
    setBusy(key);
    try {
      await action();
    } catch (e) {
      feedback.error(e);
    } finally {
      setBusy(null);
    }
  }

  return (
    <View style={styles.backup}>
      <View style={[styles.backupStatus, { backgroundColor: palette.container }]}>
        <Icon
          source={staleness.tone === "ok" ? "shield-check" : "shield-alert"}
          size={24}
          color={palette.onContainer}
        />
        <View style={styles.flex}>
          <Text variant="titleSmall" style={{ color: palette.onContainer }}>
            {staleness.text}
          </Text>
          <Text variant="bodySmall" style={{ color: palette.onContainer }}>
            Only the full JSON snapshot can restore your data.
          </Text>
        </View>
      </View>

      <SectionCard
        title="Full backup"
        subtitle="Everything, restorable. Save it somewhere off the phone."
        icon="database-outline"
      >
        <Button
          mode="contained"
          icon="download-outline"
          loading={busy === "json"}
          disabled={busy !== null}
          onPress={() =>
            run("json", async () => {
              await shareJson(
                exportPath("backup-json"),
                "dairy-backup-full.json",
                "Save your backup"
              );
              feedback.success("Backup created — save it to Drive or send it to yourself.");
            })
          }
          style={styles.action}
          contentStyle={styles.actionContent}
        >
          Create backup
        </Button>
      </SectionCard>

      <SectionCard
        title="Reports (CSV)"
        subtitle="Readable in Excel. These cannot restore your data."
        icon="file-delimited-outline"
      >
        <Text variant="bodySmall" style={[styles.label, { color: theme.colors.onSurfaceVariant }]}>
          Period
        </Text>
        <View style={styles.periodChips}>
          <Chip
            selected={period === "all"}
            showSelectedCheck={false}
            onPress={() => setPeriod("all")}
          >
            All time
          </Chip>
          {months.slice(0, 6).map((key) => (
            <Chip
              key={key}
              selected={period === key}
              showSelectedCheck={false}
              onPress={() => setPeriod(key)}
            >
              {formatMonthShort(key)}
            </Chip>
          ))}
        </View>

        <View style={styles.exportButtons}>
          <Button
            mode="contained-tonal"
            icon="account-group-outline"
            loading={busy === "customers"}
            disabled={busy !== null}
            onPress={() =>
              run("customers", () =>
                shareCsv(
                  exportPath("customers", { period }),
                  `customers-${period}.csv`,
                  "Share customer summary"
                )
              )
            }
          >
            Customer summary
          </Button>
          <Button
            mode="contained-tonal"
            icon="clipboard-text-outline"
            loading={busy === "detail"}
            disabled={busy !== null}
            onPress={() =>
              run("detail", () =>
                shareCsv(
                  exportPath(
                    "backup-csv",
                    period === "all" ? { type: "all" } : { type: "month", value: period }
                  ),
                  `dairy-${period}.csv`,
                  "Share entries, bills and payments"
                )
              )
            }
          >
            Entries, bills & payments
          </Button>
        </View>
      </SectionCard>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  semibold: { fontWeight: "600" },
  content: { padding: spacing.lg, gap: spacing.lg },
  halfTile: { width: "48%", flexGrow: 1 },
  chart: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 2,
    height: 130,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  barColumn: { flex: 1, alignItems: "center", gap: spacing.xs },
  bar: { width: "70%", borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  rank: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  backup: { gap: spacing.lg },
  backupStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
  },
  action: { borderRadius: radius.full },
  actionContent: { height: 48 },
  label: { marginBottom: spacing.sm },
  periodChips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  exportButtons: { gap: spacing.sm, marginTop: spacing.lg },
});

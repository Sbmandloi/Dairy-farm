import { useCallback, useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Button, Icon, Text, TouchableRipple, useTheme } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDashboard } from "@/hooks/queries";
import { useNetwork } from "@/hooks/use-network";
import { ErrorScreen, ListSkeleton, StatsSkeleton } from "@/components/states";
import {
  BillStatusChip,
  CustomerAvatar,
  Money,
  SectionCard,
  StatGrid,
  StatTile,
} from "@/components/ui";
import { radius, spacing } from "@/theme";
import type { AppTheme } from "@/theme";
import { formatCurrency, formatDate, formatLiters } from "@/utils/format";

/**
 * Dashboard — what is true right now.
 *
 * The web version leads with a five-across stat strip and a long table. Here
 * the same figures are grouped by the question they answer: today's collection
 * first (the thing being worked on), then the month, then who owes money. Each
 * block is a shortcut to the screen where something can be done about it — a
 * dashboard that only reports is wasted space on a phone.
 */
export default function DashboardScreen() {
  const theme = useTheme<AppTheme>();
  const insets = useSafeAreaInsets();
  const network = useNetwork();
  const { data, isLoading, isError, error, refetch, isRefetching } = useDashboard();

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  /** Active customers who have no entry recorded for today yet. */
  const missing = useMemo(
    () => data?.todayList.filter((row) => !row.entry || row.entry.totalLiters <= 0) ?? [],
    [data]
  );

  const recorded = useMemo(
    () => data?.todayList.filter((row) => row.entry && row.entry.totalLiters > 0) ?? [],
    [data]
  );

  if (isLoading) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <StatsSkeleton tiles={4} />
        <ListSkeleton rows={4} />
      </ScrollView>
    );
  }

  if (isError || !data) {
    return <ErrorScreen error={error} onRetry={() => void refetch()} />;
  }

  const { stats } = data;

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
      refreshControl={
        <RefreshControl refreshing={refreshing || isRefetching} onRefresh={onRefresh} />
      }
    >
      {!network.isOnline ? (
        <View style={[styles.offline, { backgroundColor: theme.colors.errorContainer }]}>
          <Icon source="wifi-off" size={16} color={theme.colors.onErrorContainer} />
          <Text variant="labelMedium" style={{ color: theme.colors.onErrorContainer }}>
            Offline — showing the last loaded figures
          </Text>
        </View>
      ) : null}

      <View style={styles.header}>
        <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
          {formatDate(data.today)}
        </Text>
        <Text variant="headlineSmall" style={styles.headline}>
          Today at the dairy
        </Text>
      </View>

      {/* Today */}
      <StatGrid>
        <StatTile
          label="Today's milk"
          value={formatLiters(stats.todayLiters)}
          caption={`${recorded.length} of ${data.todayList.length} recorded`}
          icon="water-outline"
          palette={theme.dairy.milk}
          style={styles.halfTile}
          onPress={() => router.push("/entry")}
        />
        <StatTile
          label="Est. revenue"
          value={formatCurrency(stats.todayRevenue)}
          caption="at each customer's rate"
          icon="cash"
          palette={theme.dairy.paid}
          style={styles.halfTile}
        />
        <StatTile
          label="This month"
          value={formatLiters(stats.monthLiters)}
          caption={formatCurrency(stats.monthRevenue)}
          icon="calendar-month-outline"
          palette={theme.dairy.billed}
          style={styles.halfTile}
          onPress={() => router.push("/monthly")}
        />
        <StatTile
          label="Outstanding"
          value={formatCurrency(stats.pendingAmount)}
          caption={`${stats.pendingBills} unpaid bill${stats.pendingBills === 1 ? "" : "s"}`}
          icon="alert-circle-outline"
          palette={stats.pendingAmount > 0.01 ? theme.dairy.due : theme.dairy.settled}
          style={styles.halfTile}
          onPress={() => router.push("/manager")}
        />
      </StatGrid>

      {/* The single most useful action at any point in the day. */}
      {missing.length > 0 ? (
        <SectionCard
          title="Entry not finished"
          subtitle={`${missing.length} customer${missing.length === 1 ? "" : "s"} still to record today`}
          icon="clipboard-alert-outline"
        >
          <View style={styles.chips}>
            {missing.slice(0, 6).map(({ customer }) => (
              <View
                key={customer.id}
                style={[styles.nameChip, { backgroundColor: theme.colors.surfaceVariant }]}
              >
                <Text variant="labelMedium" numberOfLines={1}>
                  {customer.name}
                </Text>
              </View>
            ))}
            {missing.length > 6 ? (
              <View style={[styles.nameChip, { backgroundColor: theme.colors.surfaceVariant }]}>
                <Text variant="labelMedium">+{missing.length - 6} more</Text>
              </View>
            ) : null}
          </View>
          <Button
            mode="contained"
            icon="pencil-plus-outline"
            onPress={() => router.push("/entry")}
            style={styles.blockButton}
          >
            Record today's milk
          </Button>
        </SectionCard>
      ) : data.todayList.length > 0 ? (
        <SectionCard
          title="Today is fully recorded"
          subtitle={`${formatLiters(stats.todayLiters)} across ${recorded.length} customers`}
          icon="check-circle-outline"
        >
          <Button mode="contained-tonal" icon="pencil-outline" onPress={() => router.push("/entry")}>
            Review or edit today
          </Button>
        </SectionCard>
      ) : null}

      {/* Who owes money — the reason to open the app in the evening. */}
      <SectionCard
        title="Unpaid bills"
        subtitle={
          data.pendingBills.length === 0
            ? "Everything is settled"
            : `${formatCurrency(stats.pendingAmount)} still to collect`
        }
        icon="cash-clock"
        padded={false}
        action={
          data.pendingBills.length > 0 ? (
            <Button compact onPress={() => router.push("/manager")}>
              Collect
            </Button>
          ) : null
        }
      >
        {data.pendingBills.length === 0 ? (
          <View style={styles.settled}>
            <Icon source="check-decagram-outline" size={28} color={theme.dairy.paid.onContainer} />
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              No outstanding bills right now.
            </Text>
          </View>
        ) : (
          data.pendingBills.slice(0, 6).map((bill) => (
            <TouchableRipple
              key={bill.id}
              onPress={() => router.push(`/bill/${bill.id}`)}
              style={styles.billRow}
            >
              <View style={styles.billRowInner}>
                <CustomerAvatar name={bill.customer.name} size={40} />
                <View style={styles.flex}>
                  <Text variant="bodyLarge" numberOfLines={1} style={styles.semibold}>
                    {bill.customer.name}
                  </Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    {bill.invoiceNumber}
                  </Text>
                </View>
                <View style={styles.billAmount}>
                  <Money amount={bill.due} tone="due" variant="titleSmall" />
                  <BillStatusChip status={bill.status} compact />
                </View>
              </View>
            </TouchableRipple>
          ))
        )}
        {data.pendingBills.length > 6 ? (
          <Button onPress={() => router.push("/manager")} style={styles.moreButton}>
            See all {data.pendingBills.length} unpaid bills
          </Button>
        ) : null}
      </SectionCard>

      {/* Everything else, one tap away. */}
      <View style={styles.shortcuts}>
        <Shortcut icon="receipt-text-outline" label="Billing" onPress={() => router.push("/billing")} />
        <Shortcut icon="flash-outline" label="Quick bill" onPress={() => router.push("/quick-bill")} />
        <Shortcut icon="chart-box-outline" label="Reports" onPress={() => router.push("/reports")} />
      </View>
    </ScrollView>
  );
}

function Shortcut({
  icon,
  label,
  onPress,
}: {
  icon: string;
  label: string;
  onPress: () => void;
}) {
  const theme = useTheme<AppTheme>();
  return (
    <TouchableRipple onPress={onPress} borderless style={styles.shortcut}>
      <View style={[styles.shortcutInner, { backgroundColor: theme.colors.surface }]}>
        <Icon source={icon} size={22} color={theme.colors.primary} />
        <Text variant="labelMedium" numberOfLines={1}>
          {label}
        </Text>
      </View>
    </TouchableRipple>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  semibold: { fontWeight: "600" },
  content: { padding: spacing.lg, gap: spacing.lg },
  header: { gap: 2 },
  headline: { fontWeight: "700" },
  halfTile: { width: "48%", flexGrow: 1 },
  offline: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.lg },
  nameChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.full },
  blockButton: { borderRadius: radius.full },
  settled: { alignItems: "center", gap: spacing.sm, padding: spacing.xl },
  billRow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  billRowInner: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  billAmount: { alignItems: "flex-end", gap: spacing.xs },
  moreButton: { marginVertical: spacing.sm },
  shortcuts: { flexDirection: "row", gap: spacing.md },
  shortcut: { flex: 1, borderRadius: radius.lg },
  shortcutInner: {
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
  },
});

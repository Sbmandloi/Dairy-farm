import { useCallback, useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import {
  Chip,
  FAB,
  Icon,
  Text,
  TouchableRipple,
  useTheme,
} from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCustomers } from "@/hooks/queries";
import { SearchField } from "@/components/navigators";
import { EmptyState, ErrorScreen, ListSkeleton } from "@/components/states";
import { CustomerAvatar, Money } from "@/components/ui";
import { radius, spacing } from "@/theme";
import type { AppTheme } from "@/theme";
import { displayPhone, formatLiters } from "@/utils/format";

/**
 * Customers.
 *
 * One list with three filters — everyone, only active, and the archive —
 * replacing the web's separate tabs. Each row leads with the two things being
 * looked for: who they are, and whether they owe anything.
 */

type Filter = "all" | "active" | "archived";

const FILTERS: { value: Filter; label: string; icon: string }[] = [
  { value: "all", label: "All", icon: "account-multiple-outline" },
  { value: "active", label: "Active", icon: "account-check-outline" },
  { value: "archived", label: "Archived", icon: "archive-outline" },
];

export default function CustomersScreen() {
  const theme = useTheme<AppTheme>();
  const insets = useSafeAreaInsets();

  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

  // The search term is applied client-side so typing does not fire a request per
  // keystroke; the server filter is only used for the archived/active scope.
  const query = useMemo(
    () => ({
      archived: filter === "archived" ? true : undefined,
      active: filter === "active" ? true : undefined,
    }),
    [filter]
  );

  const { data, isLoading, isError, error, refetch, isRefetching } = useCustomers(query);

  const rows = useMemo(() => {
    if (!data) return [];
    const term = search.trim().toLowerCase();
    if (!term) return data;
    return data.filter(
      (c) => c.name.toLowerCase().includes(term) || (c.phoneNumber ?? "").includes(term)
    );
  }, [data, search]);

  const totals = useMemo(
    () => ({
      owed: rows.reduce((sum, c) => sum + Math.max(0, c.stats.balance), 0),
      count: rows.length,
    }),
    [rows]
  );

  const header = (
    <View style={styles.header}>
      <View style={styles.filters}>
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
      </View>

      <SearchField value={search} onChange={setSearch} placeholder="Search name or phone" />

      {totals.count > 0 ? (
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
          {totals.count} customer{totals.count === 1 ? "" : "s"}
          {totals.owed > 0.01 ? ` · ₹${totals.owed.toFixed(0)} outstanding` : ""}
        </Text>
      ) : null}
    </View>
  );

  const onRefresh = useCallback(() => void refetch(), [refetch]);

  if (isLoading) {
    return (
      <View style={styles.fill}>
        {header}
        <ListSkeleton rows={7} />
      </View>
    );
  }

  if (isError || !data) return <ErrorScreen error={error} onRetry={onRefresh} />;

  return (
    <View style={[styles.fill, { backgroundColor: theme.colors.background }]}>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={header}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 96 }]}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <EmptyState
            icon={filter === "archived" ? "archive-outline" : "account-plus-outline"}
            title={
              search
                ? "No matches"
                : filter === "archived"
                  ? "Nothing archived"
                  : "No customers yet"
            }
            description={
              search
                ? `Nothing matches "${search}".`
                : filter === "archived"
                  ? "Archived customers keep all their history and can be restored."
                  : "Add your first customer to start recording milk."
            }
          />
        }
        renderItem={({ item }) => {
          const owes = item.stats.balance > 0.01;

          return (
            <TouchableRipple
              onPress={() => router.push(`/customer/${item.id}`)}
              style={[styles.row, { backgroundColor: theme.colors.surface }]}
            >
              <View style={styles.rowInner}>
                <CustomerAvatar name={item.name} size={46} />

                <View style={styles.flex}>
                  <View style={styles.nameLine}>
                    <Text variant="bodyLarge" numberOfLines={1} style={styles.semibold}>
                      {item.name}
                    </Text>
                    {/* Status is only worth the space when it isn't the norm. */}
                    {item.deletedAt ? (
                      <Icon source="archive" size={15} color={theme.colors.onSurfaceVariant} />
                    ) : !item.isActive ? (
                      <Icon source="pause-circle" size={15} color={theme.colors.onSurfaceVariant} />
                    ) : null}
                  </View>

                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    {item.phoneNumber ? displayPhone(item.phoneNumber) : "No phone number"}
                  </Text>

                  <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    {formatLiters(item.stats.totalLiters)} over {item.stats.deliveryDays} day
                    {item.stats.deliveryDays === 1 ? "" : "s"}
                  </Text>
                </View>

                <View style={styles.rowRight}>
                  {owes ? (
                    <>
                      <Money amount={item.stats.balance} tone="due" variant="titleSmall" />
                      <Text variant="labelSmall" style={{ color: theme.dairy.due.onContainer }}>
                        due
                      </Text>
                    </>
                  ) : item.stats.totalBilled > 0 ? (
                    <View style={[styles.settledPill, { backgroundColor: theme.dairy.paid.container }]}>
                      <Icon source="check" size={13} color={theme.dairy.paid.onContainer} />
                      <Text variant="labelSmall" style={{ color: theme.dairy.paid.onContainer }}>
                        Settled
                      </Text>
                    </View>
                  ) : (
                    <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                      No bills
                    </Text>
                  )}
                </View>
              </View>
            </TouchableRipple>
          );
        }}
      />

      <FAB
        icon="account-plus"
        label="Add"
        onPress={() => router.push("/customer/new")}
        style={[styles.fab, { bottom: insets.bottom + spacing.lg }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1 },
  semibold: { fontWeight: "600" },
  header: { gap: spacing.md, paddingBottom: spacing.sm },
  filters: { flexDirection: "row", gap: spacing.sm },
  list: { padding: spacing.lg, gap: spacing.sm },
  row: { borderRadius: radius.lg },
  rowInner: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md },
  nameLine: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  rowRight: { alignItems: "flex-end", gap: 2 },
  settledPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  fab: { position: "absolute", right: spacing.lg },
});

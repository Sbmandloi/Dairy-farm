import { useCallback, useMemo, useState } from "react";
import { FlatList, ScrollView, StyleSheet, View } from "react-native";
import {
  Button,
  Dialog,
  HelperText,
  Icon,
  Portal,
  Text,
  TextInput,
  TouchableRipple,
  useTheme,
} from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useMonthlyEntry, useSaveMonthlyEntries } from "@/hooks/queries";
import type { MonthlyChange } from "@/api/endpoints";
import { useFeedback } from "@/components/feedback";
import { MonthNavigator, SearchField } from "@/components/navigators";
import { EmptyState, ErrorScreen, ListSkeleton } from "@/components/states";
import { CustomerAvatar, StatGrid, StatTile } from "@/components/ui";
import { radius, spacing } from "@/theme";
import type { AppTheme } from "@/theme";
import { currentYearMonth, daysOfMonth, isFuture, isToday, monthKey } from "@/utils/date";
import { formatLiters, formatMonth } from "@/utils/format";

/**
 * Monthly view — the whole month, customer by day.
 *
 * The web renders a customer × day matrix, which on a phone would be a 31-column
 * table nobody can read. Instead the month is entered from the customer: pick
 * one, and their month appears as a calendar of tappable day cells. That keeps
 * every capability the grid has — see any day, correct any day — while showing
 * the one row the user is actually working on.
 *
 * Edits stage locally and save in one batch, so correcting a run of days is a
 * single write rather than one per cell.
 */
export default function MonthlyScreen() {
  const theme = useTheme<AppTheme>();
  const insets = useSafeAreaInsets();
  const feedback = useFeedback();

  const [period, setPeriod] = useState(currentYearMonth());
  const [search, setSearch] = useState("");
  const [openCustomer, setOpenCustomer] = useState<{ id: string; name: string } | null>(null);
  const [editing, setEditing] = useState<{ date: string; current: number } | null>(null);

  const { data, isLoading, isError, error, refetch } = useMonthlyEntry(period.year, period.month);
  const save = useSaveMonthlyEntries();

  /** Staged edits, keyed "customerId|date". */
  const [drafts, setDrafts] = useState<Record<string, number>>({});

  /**
   * A month change discards staged edits along with the data they belonged to.
   * Adjusted during render rather than in an effect, so the new month is never
   * painted for a frame carrying the previous month's pending edits.
   */
  const monthId = `${period.year}-${period.month}`;
  const [syncedMonth, setSyncedMonth] = useState(monthId);
  if (monthId !== syncedMonth) {
    setSyncedMonth(monthId);
    setDrafts({});
    setOpenCustomer(null);
  }

  /** Server totals per customer per day. */
  const stored = useMemo(() => {
    const map: Record<string, number> = {};
    for (const entry of data?.entries ?? []) {
      map[`${entry.customerId}|${entry.date}`] = entry.totalLiters;
    }
    return map;
  }, [data]);

  const valueFor = useCallback(
    (customerId: string, date: string): number => {
      const key = `${customerId}|${date}`;
      return drafts[key] ?? stored[key] ?? 0;
    },
    [drafts, stored]
  );

  const days = useMemo(
    () => daysOfMonth(period.year, period.month),
    [period.year, period.month]
  );

  const perCustomer = useMemo(() => {
    if (!data) return [];
    const term = search.trim().toLowerCase();

    return data.customers
      .filter((c) => !term || c.name.toLowerCase().includes(term))
      .map((customer) => {
        let total = 0;
        let recordedDays = 0;
        for (const day of days) {
          const value = valueFor(customer.id, day);
          if (value > 0) {
            total += value;
            recordedDays++;
          }
        }
        return { customer, total, recordedDays };
      });
  }, [data, search, days, valueFor]);

  const monthTotals = useMemo(() => {
    const liters = perCustomer.reduce((sum, row) => sum + row.total, 0);
    const active = perCustomer.filter((row) => row.total > 0).length;
    return { liters, active };
  }, [perCustomer]);

  const changes = useMemo<MonthlyChange[]>(
    () =>
      Object.entries(drafts)
        .filter(([key, value]) => (stored[key] ?? 0) !== value)
        .map(([key, totalLiters]) => {
          const [customerId = "", date = ""] = key.split("|");
          return { customerId, date, totalLiters };
        }),
    [drafts, stored]
  );

  const handleSave = useCallback(async () => {
    if (changes.length === 0) return;
    try {
      await save.mutateAsync(changes);
      setDrafts({});
      feedback.success(
        `Saved ${changes.length} ${changes.length === 1 ? "day" : "days"} for ${formatMonth(monthKey(period.year, period.month))}.`
      );
    } catch (e) {
      feedback.error(e);
    }
  }, [changes, save, feedback, period]);

  if (isLoading) {
    return (
      <View style={styles.fill}>
        <View style={styles.header}>
          <MonthNavigator year={period.year} month={period.month} onChange={setPeriod} />
        </View>
        <ListSkeleton rows={6} />
      </View>
    );
  }

  if (isError || !data) return <ErrorScreen error={error} onRetry={() => void refetch()} />;

  return (
    <View style={[styles.fill, { backgroundColor: theme.colors.background }]}>
      <FlatList
        data={perCustomer}
        keyExtractor={(row) => row.customer.id}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: insets.bottom + (changes.length > 0 ? 96 : spacing.xl) },
        ]}
        ListHeaderComponent={
          <View style={styles.header}>
            <MonthNavigator year={period.year} month={period.month} onChange={setPeriod} />

            <StatGrid>
              <StatTile
                label="Month total"
                value={formatLiters(monthTotals.liters)}
                caption={`${data.daysInMonth} days`}
                icon="water-outline"
                palette={theme.dairy.milk}
                style={styles.halfTile}
              />
              <StatTile
                label="Customers"
                value={String(monthTotals.active)}
                caption={`of ${data.customers.length} with milk`}
                icon="account-group-outline"
                palette={theme.dairy.billed}
                style={styles.halfTile}
              />
            </StatGrid>

            {data.customers.length > 6 ? (
              <SearchField value={search} onChange={setSearch} placeholder="Search customers" />
            ) : null}

            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              Tap a customer to see and correct their month day by day.
            </Text>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="account-search-outline"
            title={search ? "No matches" : "No active customers"}
            description={search ? `Nothing matches "${search}".` : undefined}
          />
        }
        renderItem={({ item }) => (
          <TouchableRipple
            onPress={() => setOpenCustomer({ id: item.customer.id, name: item.customer.name })}
            style={[styles.row, { backgroundColor: theme.colors.surface }]}
          >
            <View style={styles.rowInner}>
              <CustomerAvatar name={item.customer.name} size={42} />
              <View style={styles.flex}>
                <Text variant="bodyLarge" numberOfLines={1} style={styles.semibold}>
                  {item.customer.name}
                </Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  {item.recordedDays} of {data.daysInMonth} days recorded
                </Text>
              </View>
              <View style={styles.rowRight}>
                <Text variant="titleSmall" style={{ color: theme.colors.primary, fontWeight: "700" }}>
                  {formatLiters(item.total)}
                </Text>
                <Icon source="chevron-right" size={20} color={theme.colors.onSurfaceVariant} />
              </View>
            </View>
          </TouchableRipple>
        )}
      />

      {changes.length > 0 ? (
        <View
          style={[
            styles.saveBar,
            {
              backgroundColor: theme.colors.elevation.level3,
              borderTopColor: theme.colors.outlineVariant,
              paddingBottom: insets.bottom + spacing.md,
            },
          ]}
        >
          <View style={styles.flex}>
            <Text variant="titleSmall">
              {changes.length} {changes.length === 1 ? "day" : "days"} changed
            </Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              Not saved yet
            </Text>
          </View>
          <Button
            mode="contained"
            icon="content-save-outline"
            onPress={handleSave}
            loading={save.isPending}
            disabled={save.isPending}
            style={styles.saveButton}
            contentStyle={styles.saveButtonContent}
          >
            Save
          </Button>
        </View>
      ) : null}

      {/* One customer's month as a calendar of tappable cells. */}
      <Portal>
        <Dialog
          visible={openCustomer !== null}
          onDismiss={() => setOpenCustomer(null)}
          style={styles.calendarDialog}
        >
          <Dialog.Title numberOfLines={1}>{openCustomer?.name}</Dialog.Title>
          <Dialog.ScrollArea>
            <ScrollView contentContainerStyle={styles.calendarScroll}>
              <Text variant="bodySmall" style={[styles.calendarHint, { color: theme.colors.onSurfaceVariant }]}>
                {formatMonth(monthKey(period.year, period.month))} · tap any day to set the quantity
              </Text>

              <View style={styles.calendar}>
                {days.map((day) => {
                  const value = openCustomer ? valueFor(openCustomer.id, day) : 0;
                  const key = openCustomer ? `${openCustomer.id}|${day}` : "";
                  const isChanged = key in drafts && (stored[key] ?? 0) !== drafts[key];
                  const future = isFuture(day);
                  const dayNumber = Number(day.slice(8));

                  return (
                    <TouchableRipple
                      key={day}
                      disabled={future}
                      onPress={() => {
                        void Haptics.selectionAsync();
                        setEditing({ date: day, current: value });
                      }}
                      style={styles.cellTouch}
                      borderless
                    >
                      <View
                        style={[
                          styles.cell,
                          {
                            backgroundColor: isChanged
                              ? theme.colors.primaryContainer
                              : value > 0
                                ? theme.dairy.milk.container
                                : theme.colors.surfaceVariant,
                            opacity: future ? 0.35 : 1,
                            borderWidth: isToday(day) ? 1.5 : 0,
                            borderColor: theme.colors.primary,
                          },
                        ]}
                      >
                        <Text
                          variant="labelSmall"
                          style={{
                            color: value > 0 ? theme.dairy.milk.onContainer : theme.colors.onSurfaceVariant,
                          }}
                        >
                          {dayNumber}
                        </Text>
                        <Text
                          variant="labelMedium"
                          style={{
                            fontWeight: "700",
                            color: value > 0 ? theme.dairy.milk.onContainer : theme.colors.onSurfaceVariant,
                          }}
                        >
                          {value > 0 ? value.toFixed(1) : "—"}
                        </Text>
                      </View>
                    </TouchableRipple>
                  );
                })}
              </View>
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setOpenCustomer(null)}>Done</Button>
          </Dialog.Actions>
        </Dialog>

        <DayEditDialog
          visible={editing !== null}
          date={editing?.date ?? ""}
          current={editing?.current ?? 0}
          onDismiss={() => setEditing(null)}
          onSubmit={(liters) => {
            if (openCustomer && editing) {
              setDrafts((prev) => ({ ...prev, [`${openCustomer.id}|${editing.date}`]: liters }));
            }
            setEditing(null);
          }}
        />
      </Portal>
    </View>
  );
}

function DayEditDialog({
  visible,
  date,
  current,
  onDismiss,
  onSubmit,
}: {
  visible: boolean;
  date: string;
  current: number;
  onDismiss: () => void;
  onSubmit: (liters: number) => void;
}) {
  const [value, setValue] = useState("");

  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setValue(current > 0 ? String(current) : "");
  }

  const parsed = value.trim() === "" ? 0 : parseFloat(value);
  const invalid = Number.isNaN(parsed) || parsed < 0;

  return (
    <Dialog visible={visible} onDismiss={onDismiss}>
      <Dialog.Title>{date ? formatDayTitle(date) : ""}</Dialog.Title>
      <Dialog.Content>
        <TextInput
          label="Quantity"
          value={value}
          onChangeText={(text) => setValue(text.replace(/[^0-9.]/g, ""))}
          mode="outlined"
          keyboardType="decimal-pad"
          right={<TextInput.Affix text="L" />}
          autoFocus
        />
        <HelperText type="info" visible>
          Leave it blank or enter 0 to remove this day's entry.
        </HelperText>
      </Dialog.Content>
      <Dialog.Actions>
        <Button onPress={onDismiss}>Cancel</Button>
        <Button mode="contained" disabled={invalid} onPress={() => onSubmit(parsed)}>
          Set
        </Button>
      </Dialog.Actions>
    </Dialog>
  );
}

function formatDayTitle(date: string): string {
  const [year = "", month = "", day = ""] = date.split("-");
  return `${day} ${formatMonth(`${year}-${month}`)}`;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1 },
  semibold: { fontWeight: "600" },
  header: { gap: spacing.md, paddingBottom: spacing.md },
  halfTile: { width: "48%", flexGrow: 1 },
  list: { padding: spacing.lg, gap: spacing.sm },
  row: { borderRadius: radius.lg },
  rowInner: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md },
  rowRight: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  saveBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  saveButton: { borderRadius: radius.full },
  saveButtonContent: { height: 48, paddingHorizontal: spacing.lg },
  calendarDialog: { maxHeight: "85%" },
  calendarScroll: { paddingVertical: spacing.md },
  calendarHint: { marginBottom: spacing.md },
  calendar: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  cellTouch: { borderRadius: radius.md },
  cell: {
    width: 58,
    height: 52,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
});

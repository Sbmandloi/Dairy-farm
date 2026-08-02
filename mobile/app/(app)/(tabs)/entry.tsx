import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Button,
  Chip,
  Icon,
  IconButton,
  Menu,
  SegmentedButtons,
  Text,
  TextInput,
  TouchableRipple,
  useTheme,
} from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useNavigation } from "expo-router";
import { useDailyEntry, useSaveDailyEntries } from "@/hooks/queries";
import * as endpoints from "@/api/endpoints";
import type { DailyEntryItem } from "@/api/endpoints";
import type { DailyEntryData } from "@/api/types";
import { CustomerAvatar } from "@/components/ui";
import { DateNavigator, SearchField } from "@/components/navigators";
import { EmptyState, ErrorScreen, ListSkeleton } from "@/components/states";
import { useFeedback } from "@/components/feedback";
import { radius, spacing } from "@/theme";
import type { AppTheme } from "@/theme";
import { formatCurrency, formatLiters } from "@/utils/format";
import { today } from "@/utils/date";
import {
  displayToLiters,
  litersToDisplay,
  loadUnitPrefs,
  saveUnitPrefs,
  type Unit,
} from "@/utils/preferences";

/**
 * Daily entry — the screen that gets used every single morning and evening.
 *
 * The web version is a wide grid with a row per customer and columns for
 * morning, evening and total. That does not survive a 360dp screen, so here
 * each customer is a card: collapsed it shows just the recorded quantity, and
 * tapping it expands the fields, the quick-add chips and the unit toggle. Only
 * one card is open at a time, which keeps the keyboard from covering the row
 * being edited.
 *
 * Nothing is saved until the user says so, exactly like the web grid — a
 * half-typed number must never reach the database, and the farmer often walks
 * the whole round before saving once.
 */

const QUICK_AMOUNTS = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5];

interface RowDraft {
  morning: string;
  evening: string;
  total: string;
}

/** In split mode the total is always the sum — it is never typed directly. */
function computeTotal(draft: RowDraft, isSplit: boolean): number {
  if (!isSplit) return parseFloat(draft.total) || 0;
  return (parseFloat(draft.morning) || 0) + (parseFloat(draft.evening) || 0);
}

function draftFromEntry(
  entry: { morningLiters: number | null; eveningLiters: number | null; totalLiters: number } | null
): RowDraft {
  if (!entry) return { morning: "", evening: "", total: "" };
  return {
    morning: entry.morningLiters !== null ? String(entry.morningLiters) : "",
    evening: entry.eveningLiters !== null ? String(entry.eveningLiters) : "",
    total: entry.totalLiters ? String(entry.totalLiters) : "",
  };
}

/** What the server currently has, as drafts — the thing edits are compared against. */
function baselineFrom(data: DailyEntryData | undefined): Record<string, RowDraft> {
  const next: Record<string, RowDraft> = {};
  for (const row of data?.rows ?? []) next[row.customer.id] = draftFromEntry(row.entry);
  return next;
}

export default function DailyEntryScreen() {
  const theme = useTheme<AppTheme>();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const feedback = useFeedback();

  const [date, setDate] = useState(today());
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [copying, setCopying] = useState(false);

  const { data, isLoading, isError, error, refetch } = useDailyEntry(date);
  const save = useSaveDailyEntries();

  const [drafts, setDrafts] = useState<Record<string, RowDraft>>({});
  const [units, setUnits] = useState<Record<string, Unit>>({});

  useEffect(() => {
    void loadUnitPrefs().then(setUnits);
  }, []);

  /**
   * What the server currently has. Derived rather than stored, so it can never
   * drift out of sync with the data the rows are rendered from.
   */
  const baseline = useMemo(() => baselineFrom(data), [data]);

  /**
   * Reset the drafts whenever the day changes or fresh data arrives, so the
   * screen can never show one day's numbers under another day's heading.
   *
   * Adjusted during render rather than in an effect: an effect would render one
   * frame of the previous day's quantities under the new date before correcting
   * itself, which on a slow phone is visible and alarming.
   */
  const [syncedFrom, setSyncedFrom] = useState(data);
  if (data && data !== syncedFrom) {
    setSyncedFrom(data);
    setDrafts(baselineFrom(data));
    setExpandedId(null);
  }

  const isSplit = data?.entryMode === "SPLIT";

  const setDraft = useCallback((customerId: string, patch: Partial<RowDraft>) => {
    setDrafts((prev) => ({
      ...prev,
      [customerId]: { ...(prev[customerId] ?? { morning: "", evening: "", total: "" }), ...patch },
    }));
  }, []);

  const toggleUnit = useCallback(
    (customerId: string) => {
      setUnits((prev) => {
        const next = { ...prev, [customerId]: prev[customerId] === "ml" ? "L" : ("ml" as Unit) };
        void saveUnitPrefs(next);
        return next;
      });
      void Haptics.selectionAsync();
    },
    []
  );

  /** Rows whose numbers differ from what the server has. */
  const changed = useMemo(() => {
    const result: DailyEntryItem[] = [];
    for (const [customerId, draft] of Object.entries(drafts)) {
      const before = baseline[customerId];
      if (!before) continue;
      if (
        before.morning === draft.morning &&
        before.evening === draft.evening &&
        before.total === draft.total
      ) {
        continue;
      }

      const total = computeTotal(draft, Boolean(isSplit));
      result.push({
        customerId,
        // null, not undefined: clearing just the morning must actually wipe it.
        // The server coalesces undefined→null too, but being explicit here keeps
        // the intent visible at the call site.
        morningLiters: isSplit ? (draft.morning === "" ? null : parseFloat(draft.morning)) : null,
        eveningLiters: isSplit ? (draft.evening === "" ? null : parseFloat(draft.evening)) : null,
        totalLiters: total,
      });
    }
    return result;
  }, [drafts, baseline, isSplit]);

  const visibleRows = useMemo(() => {
    if (!data) return [];
    const query = search.trim().toLowerCase();
    if (!query) return data.rows;
    return data.rows.filter(
      (row) =>
        row.customer.name.toLowerCase().includes(query) ||
        (row.customer.phoneNumber ?? "").includes(query)
    );
  }, [data, search]);

  /** Live summary from the drafts, so the totals move as the user types. */
  const summary = useMemo(() => {
    if (!data) return { liters: 0, revenue: 0, count: 0 };
    let liters = 0;
    let revenue = 0;
    let count = 0;
    for (const row of data.rows) {
      const draft = drafts[row.customer.id];
      if (!draft) continue;
      const total = computeTotal(draft, Boolean(isSplit));
      if (total <= 0) continue;
      count++;
      liters += total;
      revenue += total * (row.customer.pricePerLiter ?? data.globalPricePerLiter);
    }
    return { liters, revenue, count };
  }, [data, drafts, isSplit]);

  const handleSave = useCallback(async () => {
    if (changed.length === 0) return;
    try {
      await save.mutateAsync({ date, entries: changed });
      feedback.success(
        `Saved ${changed.length} ${changed.length === 1 ? "entry" : "entries"} for this day.`
      );
    } catch (e) {
      feedback.error(e);
    }
  }, [changed, date, save, feedback]);

  /** Pre-fill from yesterday, leaving it unsaved so it can be corrected first. */
  const handleCopyPrevious = useCallback(async () => {
    setMenuOpen(false);
    setCopying(true);
    try {
      const previous = await endpoints.getPreviousDay(date);
      if (previous.length === 0) {
        feedback.info("Yesterday has no entries to copy.");
        return;
      }
      setDrafts((prev) => {
        const next = { ...prev };
        for (const entry of previous) {
          if (!(entry.customerId in next)) continue;
          next[entry.customerId] = {
            morning: entry.morningLiters !== null ? String(entry.morningLiters) : "",
            evening: entry.eveningLiters !== null ? String(entry.eveningLiters) : "",
            total: String(entry.totalLiters),
          };
        }
        return next;
      });
      feedback.info(`Filled in ${previous.length} entries from yesterday — review, then save.`);
    } catch (e) {
      feedback.error(e);
    } finally {
      setCopying(false);
    }
  }, [date, feedback]);

  const handleClearAll = useCallback(() => {
    setMenuOpen(false);
    setDrafts((prev) => {
      const next: Record<string, RowDraft> = {};
      for (const id of Object.keys(prev)) next[id] = { morning: "", evening: "", total: "" };
      return next;
    });
    feedback.info("All quantities cleared — save to apply.");
  }, [feedback]);

  // The overflow menu lives in the header so the list keeps its full height.
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
            leadingIcon="content-duplicate"
            onPress={handleCopyPrevious}
            title="Copy yesterday"
          />
          <Menu.Item leadingIcon="eraser" onPress={handleClearAll} title="Clear all" />
        </Menu>
      ),
    });
  }, [navigation, menuOpen, handleCopyPrevious, handleClearAll]);

  const header = (
    <View style={styles.header}>
      <DateNavigator date={date} onChange={setDate} />

      <View style={styles.summaryRow}>
        <SummaryPill
          icon="water-outline"
          label="Milk"
          value={formatLiters(summary.liters)}
          palette={theme.dairy.milk}
        />
        <SummaryPill
          icon="account-check-outline"
          label="Recorded"
          value={`${summary.count}/${data?.rows.length ?? 0}`}
          palette={theme.dairy.billed}
        />
        <SummaryPill
          icon="cash"
          label="Est."
          value={formatCurrency(summary.revenue)}
          palette={theme.dairy.paid}
        />
      </View>

      {(data?.rows.length ?? 0) > 6 ? (
        <SearchField value={search} onChange={setSearch} placeholder="Search customers" />
      ) : null}

      {copying ? (
        <View style={styles.copying}>
          <ActivityIndicator size="small" />
          <Text variant="bodySmall">Loading yesterday's entries…</Text>
        </View>
      ) : null}
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.fill}>
        {header}
        <ListSkeleton rows={6} cardHeight={68} />
      </View>
    );
  }

  if (isError || !data) {
    return <ErrorScreen error={error} onRetry={() => void refetch()} />;
  }

  return (
    <View style={[styles.fill, { backgroundColor: theme.colors.background }]}>
      <FlatList
        data={visibleRows}
        keyExtractor={(row) => row.customer.id}
        ListHeaderComponent={header}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: insets.bottom + (changed.length > 0 ? 96 : spacing.xl) },
        ]}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          search ? (
            <EmptyState
              icon="account-search-outline"
              title="No matching customers"
              description={`Nothing matches "${search}".`}
            />
          ) : (
            <EmptyState
              icon="account-plus-outline"
              title="No active customers"
              description="Add a customer before recording milk."
            />
          )
        }
        renderItem={({ item }) => {
          const draft = drafts[item.customer.id] ?? { morning: "", evening: "", total: "" };
          const unit = units[item.customer.id] ?? "L";
          const total = computeTotal(draft, Boolean(isSplit));
          const before = baseline[item.customer.id];
          const isDirty =
            before !== undefined &&
            (before.morning !== draft.morning ||
              before.evening !== draft.evening ||
              before.total !== draft.total);

          return (
            <EntryRow
              name={item.customer.name}
              phone={item.customer.phoneNumber}
              rate={item.customer.pricePerLiter ?? data.globalPricePerLiter}
              hasCustomRate={item.customer.pricePerLiter !== null}
              draft={draft}
              unit={unit}
              total={total}
              isSplit={Boolean(isSplit)}
              isDirty={isDirty}
              expanded={expandedId === item.customer.id}
              onToggle={() =>
                setExpandedId((prev) => (prev === item.customer.id ? null : item.customer.id))
              }
              onChange={(patch) => setDraft(item.customer.id, patch)}
              onToggleUnit={() => toggleUnit(item.customer.id)}
            />
          );
        }}
      />

      {/* The save bar only exists when there is something to save, so the
          list keeps its full height the rest of the time. */}
      {changed.length > 0 ? (
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
              {changed.length} {changed.length === 1 ? "change" : "changes"}
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
    </View>
  );
}

function SummaryPill({
  icon,
  label,
  value,
  palette,
}: {
  icon: string;
  label: string;
  value: string;
  palette: { container: string; onContainer: string };
}) {
  return (
    <View style={[styles.pill, { backgroundColor: palette.container }]}>
      <Icon source={icon} size={16} color={palette.onContainer} />
      <View style={styles.flex}>
        <Text variant="labelSmall" style={{ color: palette.onContainer, opacity: 0.8 }}>
          {label}
        </Text>
        <Text
          variant="titleSmall"
          numberOfLines={1}
          adjustsFontSizeToFit
          style={{ color: palette.onContainer, fontWeight: "700" }}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

interface EntryRowProps {
  name: string;
  phone: string | null;
  rate: number;
  hasCustomRate: boolean;
  draft: RowDraft;
  unit: Unit;
  total: number;
  isSplit: boolean;
  isDirty: boolean;
  expanded: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<RowDraft>) => void;
  onToggleUnit: () => void;
}

function EntryRow({
  name,
  rate,
  hasCustomRate,
  draft,
  unit,
  total,
  isSplit,
  isDirty,
  expanded,
  onToggle,
  onChange,
  onToggleUnit,
}: EntryRowProps) {
  const theme = useTheme<AppTheme>();

  /** Which field a quick-add chip should fill, in split mode. */
  const [target, setTarget] = useState<"morning" | "evening">("morning");

  const field = (which: "morning" | "evening" | "total") => ({
    value: litersToDisplay(draft[which], unit),
    onChangeText: (text: string) => {
      // Accept digits and a single decimal point only; a stray letter would
      // silently become NaN and wipe the quantity on save.
      const cleaned = text.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");
      onChange({ [which]: displayToLiters(cleaned, unit) } as Partial<RowDraft>);
    },
  });

  const applyQuick = (amount: number) => {
    void Haptics.selectionAsync();
    if (!isSplit) {
      onChange({ total: String(amount) });
      return;
    }
    onChange({ [target]: String(amount) } as Partial<RowDraft>);
  };

  return (
    <View
      style={[
        styles.row,
        {
          backgroundColor: theme.colors.surface,
          borderColor: isDirty ? theme.colors.primary : theme.colors.outlineVariant,
          borderWidth: isDirty ? 1.5 : StyleSheet.hairlineWidth,
        },
      ]}
    >
      <TouchableRipple onPress={onToggle} borderless style={styles.rowHeadTouch}>
        <View style={styles.rowHead}>
          <CustomerAvatar name={name} size={40} />
          <View style={styles.flex}>
            <Text variant="bodyLarge" numberOfLines={1} style={styles.semibold}>
              {name}
            </Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {formatCurrency(rate)}/L{hasCustomRate ? " · custom rate" : ""}
            </Text>
          </View>

          <View style={styles.rowTotal}>
            <Text
              variant="titleMedium"
              style={{
                color: total > 0 ? theme.colors.primary : theme.colors.onSurfaceVariant,
                fontWeight: "700",
              }}
            >
              {total > 0 ? formatLiters(total) : "—"}
            </Text>
            {total > 0 ? (
              <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                {formatCurrency(total * rate)}
              </Text>
            ) : null}
          </View>

          <Icon
            source={expanded ? "chevron-up" : "chevron-down"}
            size={22}
            color={theme.colors.onSurfaceVariant}
          />
        </View>
      </TouchableRipple>

      {expanded ? (
        <View style={styles.rowBody}>
          {isSplit ? (
            <View style={styles.fieldRow}>
              <TextInput
                {...field("morning")}
                label="Morning"
                mode="outlined"
                keyboardType="decimal-pad"
                dense
                style={styles.flex}
                right={<TextInput.Affix text={unit} />}
                onFocus={() => setTarget("morning")}
              />
              <TextInput
                {...field("evening")}
                label="Evening"
                mode="outlined"
                keyboardType="decimal-pad"
                dense
                style={styles.flex}
                right={<TextInput.Affix text={unit} />}
                onFocus={() => setTarget("evening")}
              />
            </View>
          ) : (
            <TextInput
              {...field("total")}
              label="Total quantity"
              mode="outlined"
              keyboardType="decimal-pad"
              dense
              right={<TextInput.Affix text={unit} />}
            />
          )}

          {isSplit ? (
            <SegmentedButtons
              value={target}
              onValueChange={(value) => setTarget(value as "morning" | "evening")}
              density="small"
              buttons={[
                { value: "morning", label: "Fill morning", icon: "weather-sunset-up" },
                { value: "evening", label: "Fill evening", icon: "weather-night" },
              ]}
            />
          ) : null}

          <View style={styles.quickRow}>
            {QUICK_AMOUNTS.map((amount) => (
              <Chip
                key={amount}
                compact
                onPress={() => applyQuick(amount)}
                style={styles.quickChip}
                textStyle={styles.quickChipText}
              >
                {amount}
              </Chip>
            ))}
          </View>

          <View style={styles.rowActions}>
            <Button
              compact
              icon="swap-horizontal"
              onPress={onToggleUnit}
              textColor={theme.colors.onSurfaceVariant}
            >
              Enter in {unit === "L" ? "ml" : "litres"}
            </Button>
            <Button
              compact
              icon="close"
              textColor={theme.colors.onSurfaceVariant}
              onPress={() => onChange({ morning: "", evening: "", total: "" })}
            >
              Clear
            </Button>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1 },
  semibold: { fontWeight: "600" },
  header: { gap: spacing.md, paddingBottom: spacing.md },
  summaryRow: { flexDirection: "row", gap: spacing.sm },
  pill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.md,
  },
  copying: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  list: { padding: spacing.lg, gap: spacing.sm },
  row: { borderRadius: radius.lg, overflow: "hidden" },
  rowHeadTouch: { borderRadius: radius.lg },
  rowHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
  },
  rowTotal: { alignItems: "flex-end" },
  rowBody: { padding: spacing.md, paddingTop: 0, gap: spacing.md },
  fieldRow: { flexDirection: "row", gap: spacing.md },
  quickRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  quickChip: { minWidth: 44 },
  quickChipText: { marginHorizontal: spacing.sm },
  rowActions: { flexDirection: "row", justifyContent: "space-between" },
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
});

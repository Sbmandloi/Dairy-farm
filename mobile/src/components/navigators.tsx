import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Dialog, IconButton, Portal, Searchbar, Text, useTheme } from "react-native-paper";
import * as Haptics from "expo-haptics";
import { radius, spacing } from "@/theme";
import type { AppTheme } from "@/theme";
import {
  addDays,
  currentYearMonth,
  isFuture,
  isToday,
  monthKey,
  shiftMonth,
  today,
  weekdayName,
} from "@/utils/date";
import { formatDate, formatMonth } from "@/utils/format";

/**
 * Period pickers.
 *
 * On the web these are calendar popovers. On a phone the overwhelmingly common
 * action is "the day before" or "last month", so the primary control is a pair
 * of large arrows with the current period between them — one thumb tap instead
 * of opening a calendar and hunting for a cell. The full picker is still one
 * tap away for jumping further.
 */

// ── day ─────────────────────────────────────────────────────────────────────

export function DateNavigator({
  date,
  onChange,
}: {
  date: string;
  onChange: (next: string) => void;
}) {
  const theme = useTheme<AppTheme>();
  const [pickerOpen, setPickerOpen] = useState(false);

  const step = (days: number) => {
    const next = addDays(date, days);
    // Milk cannot be recorded before it is collected; blocking the future here
    // is friendlier than letting the user land on an empty day and wonder why.
    if (isFuture(next)) return;
    void Haptics.selectionAsync();
    onChange(next);
  };

  const atToday = isToday(date);

  return (
    <>
      <View style={[styles.bar, { backgroundColor: theme.colors.surface }]}>
        <IconButton
          icon="chevron-left"
          size={26}
          onPress={() => step(-1)}
          accessibilityLabel="Previous day"
        />

        <Button
          mode="text"
          onPress={() => setPickerOpen(true)}
          contentStyle={styles.centerButton}
          style={styles.flex}
        >
          <View style={styles.centerLabel}>
            <Text variant="titleSmall">{atToday ? "Today" : formatDate(date)}</Text>
            <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {atToday ? formatDate(date) : weekdayName(date)}
            </Text>
          </View>
        </Button>

        <IconButton
          icon="chevron-right"
          size={26}
          disabled={atToday}
          onPress={() => step(1)}
          accessibilityLabel="Next day"
        />
      </View>

      <DayPickerDialog
        visible={pickerOpen}
        date={date}
        onDismiss={() => setPickerOpen(false)}
        onSelect={(next) => {
          setPickerOpen(false);
          onChange(next);
        }}
      />
    </>
  );
}

/**
 * Day picker.
 *
 * A month grid rather than three spinners: picking "the 14th" is one tap, and
 * the grid also shows at a glance which days are still in the future and
 * therefore not selectable.
 */
function DayPickerDialog({
  visible,
  date,
  onDismiss,
  onSelect,
}: {
  visible: boolean;
  date: string;
  onDismiss: () => void;
  onSelect: (date: string) => void;
}) {
  const theme = useTheme<AppTheme>();
  const [y = 0, m = 1] = date.split("-").map(Number);
  const [view, setView] = useState({ year: y, month: m });

  // Re-anchor the grid whenever the dialog is reopened on a different day.
  const [lastDate, setLastDate] = useState(date);
  if (date !== lastDate) {
    setLastDate(date);
    setView({ year: y, month: m });
  }

  const daysInMonth = new Date(Date.UTC(view.year, view.month, 0)).getUTCDate();
  const firstWeekday = new Date(Date.UTC(view.year, view.month - 1, 1)).getUTCDay();
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
        <Dialog.Title>Pick a date</Dialog.Title>
        <Dialog.Content>
          <View style={styles.monthHead}>
            <IconButton
              icon="chevron-left"
              onPress={() => setView((v) => shiftMonth(v.year, v.month, -1))}
              accessibilityLabel="Previous month"
            />
            <Text variant="titleSmall" style={styles.monthTitle}>
              {formatMonth(monthKey(view.year, view.month))}
            </Text>
            <IconButton
              icon="chevron-right"
              onPress={() => setView((v) => shiftMonth(v.year, v.month, 1))}
              accessibilityLabel="Next month"
            />
          </View>

          <View style={styles.weekHead}>
            {["S", "M", "T", "W", "T", "F", "S"].map((label, i) => (
              <Text
                key={i}
                variant="labelSmall"
                style={[styles.weekCell, { color: theme.colors.onSurfaceVariant }]}
              >
                {label}
              </Text>
            ))}
          </View>

          <View style={styles.grid}>
            {Array.from({ length: firstWeekday }, (_, i) => (
              <View key={`blank-${i}`} style={styles.dayCell} />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = `${view.year}-${pad(view.month)}-${pad(i + 1)}`;
              const selected = day === date;
              const future = isFuture(day);
              const current = isToday(day);

              return (
                <Button
                  key={day}
                  mode={selected ? "contained" : "text"}
                  compact
                  disabled={future}
                  onPress={() => onSelect(day)}
                  style={[
                    styles.dayCell,
                    current && !selected
                      ? { borderWidth: 1, borderColor: theme.colors.primary, borderRadius: radius.full }
                      : null,
                  ]}
                  labelStyle={styles.dayLabel}
                >
                  {String(i + 1)}
                </Button>
              );
            })}
          </View>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={() => onSelect(today())}>Today</Button>
          <Button onPress={onDismiss}>Close</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

// ── month ───────────────────────────────────────────────────────────────────

export function MonthNavigator({
  year,
  month,
  onChange,
  /** Months ahead of the current one are usually meaningless for billing. */
  allowFuture = false,
}: {
  year: number;
  month: number;
  onChange: (next: { year: number; month: number }) => void;
  allowFuture?: boolean;
}) {
  const theme = useTheme<AppTheme>();
  const now = currentYearMonth();
  const atLatest = !allowFuture && year === now.year && month === now.month;

  const step = (delta: number) => {
    const next = shiftMonth(year, month, delta);
    if (!allowFuture && (next.year > now.year || (next.year === now.year && next.month > now.month))) {
      return;
    }
    void Haptics.selectionAsync();
    onChange(next);
  };

  return (
    <View style={[styles.bar, { backgroundColor: theme.colors.surface }]}>
      <IconButton
        icon="chevron-left"
        size={26}
        onPress={() => step(-1)}
        accessibilityLabel="Previous month"
      />
      <View style={[styles.flex, styles.centerLabel]}>
        <Text variant="titleSmall">{formatMonth(monthKey(year, month))}</Text>
        <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
          1st to last day
        </Text>
      </View>
      <IconButton
        icon="chevron-right"
        size={26}
        disabled={atLatest}
        onPress={() => step(1)}
        accessibilityLabel="Next month"
      />
    </View>
  );
}

// ── search ──────────────────────────────────────────────────────────────────

export function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
}) {
  const theme = useTheme<AppTheme>();
  return (
    <Searchbar
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      mode="bar"
      style={[styles.search, { backgroundColor: theme.colors.surfaceVariant }]}
      inputStyle={styles.searchInput}
      elevation={0}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.lg,
    paddingHorizontal: spacing.xs,
  },
  centerButton: { height: 52 },
  centerLabel: { alignItems: "center", justifyContent: "center" },
  dialog: { maxHeight: "88%" },
  monthHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  monthTitle: { flex: 1, textAlign: "center" },
  weekHead: { flexDirection: "row", marginBottom: spacing.xs },
  weekCell: { width: `${100 / 7}%`, textAlign: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  dayCell: { width: `${100 / 7}%`, minWidth: 0, marginVertical: 1 },
  dayLabel: { marginHorizontal: 0, fontSize: 13 },
  search: { borderRadius: radius.full },
  searchInput: { minHeight: 0 },
});

import { type ReactNode } from "react";
import { Pressable, StyleSheet, View, type ViewStyle } from "react-native";
import { Chip, Icon, Surface, Text, TouchableRipple, useTheme } from "react-native-paper";
import { radius, spacing, TOUCH_TARGET } from "@/theme";
import type { AppTheme, StatusPalette } from "@/theme";
import { formatCurrency, formatCurrencyCompact, initials } from "@/utils/format";
import type { BillStatus } from "@/api/types";

/** Building blocks shared by every screen. */

// ── stat tile ───────────────────────────────────────────────────────────────

export interface StatTileProps {
  label: string;
  value: string;
  caption?: string;
  icon: string;
  palette: StatusPalette;
  onPress?: () => void;
  style?: ViewStyle;
}

/**
 * A single headline figure.
 *
 * The label sits above the value rather than beside it, so tiles stay readable
 * two-across on a 360dp phone — the desktop's five-across strip does not
 * survive the narrower screen, and squeezing it would make every number tiny.
 */
export function StatTile({ label, value, caption, icon, palette, onPress, style }: StatTileProps) {
  const content = (
    <View style={[styles.tile, { backgroundColor: palette.container }, style]}>
      <View style={styles.tileHead}>
        <Icon source={icon} size={18} color={palette.onContainer} />
        <Text
          variant="labelSmall"
          numberOfLines={1}
          style={[styles.tileLabel, { color: palette.onContainer }]}
        >
          {label}
        </Text>
      </View>
      <Text
        variant="titleLarge"
        numberOfLines={1}
        adjustsFontSizeToFit
        style={{ color: palette.onContainer }}
      >
        {value}
      </Text>
      {caption ? (
        <Text variant="labelSmall" numberOfLines={1} style={{ color: palette.onContainer, opacity: 0.75 }}>
          {caption}
        </Text>
      ) : null}
    </View>
  );

  if (!onPress) return content;
  return (
    <TouchableRipple onPress={onPress} borderless style={[styles.tileTouch, style]}>
      {content}
    </TouchableRipple>
  );
}

/** Two-column grid the stat tiles sit in. */
export function StatGrid({ children }: { children: ReactNode }) {
  return <View style={styles.statGrid}>{children}</View>;
}

// ── section card ────────────────────────────────────────────────────────────

export function SectionCard({
  title,
  subtitle,
  icon,
  action,
  children,
  padded = true,
}: {
  title?: string;
  subtitle?: string;
  icon?: string;
  action?: ReactNode;
  children: ReactNode;
  padded?: boolean;
}) {
  const theme = useTheme<AppTheme>();

  return (
    <Surface elevation={1} style={[styles.card, { backgroundColor: theme.colors.surface }]}>
      {title ? (
        <View style={styles.cardHead}>
          {icon ? (
            <View style={[styles.cardIcon, { backgroundColor: theme.colors.primaryContainer }]}>
              <Icon source={icon} size={18} color={theme.colors.onPrimaryContainer} />
            </View>
          ) : null}
          <View style={styles.flex}>
            <Text variant="titleSmall">{title}</Text>
            {subtitle ? (
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          {action}
        </View>
      ) : null}
      <View style={padded ? styles.cardBody : undefined}>{children}</View>
    </Surface>
  );
}

// ── bill status ─────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<BillStatus, string> = {
  GENERATED: "Generated",
  SENT: "Sent",
  PAID: "Paid",
  PARTIALLY_PAID: "Partly paid",
};

const STATUS_ICONS: Record<BillStatus, string> = {
  GENERATED: "file-document-outline",
  SENT: "send-check-outline",
  PAID: "check-circle",
  PARTIALLY_PAID: "circle-slice-4",
};

export function statusPalette(theme: AppTheme, status: BillStatus): StatusPalette {
  switch (status) {
    case "PAID":
      return theme.dairy.paid;
    case "PARTIALLY_PAID":
      return theme.dairy.partial;
    case "SENT":
      return theme.dairy.billed;
    default:
      return theme.dairy.pending;
  }
}

export function BillStatusChip({ status, compact }: { status: BillStatus; compact?: boolean }) {
  const theme = useTheme<AppTheme>();
  const palette = statusPalette(theme, status);

  return (
    <Chip
      compact={compact}
      icon={() => <Icon source={STATUS_ICONS[status]} size={14} color={palette.onContainer} />}
      style={{ backgroundColor: palette.container }}
      textStyle={{ color: palette.onContainer, fontSize: 11, fontWeight: "600" }}
    >
      {STATUS_LABELS[status]}
    </Chip>
  );
}

// ── money ───────────────────────────────────────────────────────────────────

/**
 * An amount, tinted by what it means: green when settled, orange when owed.
 *
 * Colour is never the only signal — the figure and its label always say the
 * same thing — so this stays readable for a colour-blind user.
 */
export function Money({
  amount,
  tone = "neutral",
  variant = "titleMedium",
  compact,
}: {
  amount: number;
  tone?: "neutral" | "due" | "paid";
  variant?: "bodyMedium" | "bodyLarge" | "titleSmall" | "titleMedium" | "titleLarge";
  compact?: boolean;
}) {
  const theme = useTheme<AppTheme>();
  const color =
    tone === "due"
      ? theme.dairy.due.onContainer
      : tone === "paid"
        ? theme.dairy.paid.onContainer
        : theme.colors.onSurface;

  return (
    <Text variant={variant} style={{ color, fontWeight: "700" }}>
      {compact ? formatCurrencyCompact(amount) : formatCurrency(amount)}
    </Text>
  );
}

// ── avatar ──────────────────────────────────────────────────────────────────

/**
 * Initials avatar with a colour derived from the name.
 *
 * A stable per-customer colour makes a long list scannable — the farmer learns
 * the shape of a regular customer's row without reading it.
 */
const AVATAR_HUES = [210, 190, 260, 340, 20, 150, 280, 40];

export function CustomerAvatar({ name, size = 44 }: { name: string; size?: number }) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  const hue = AVATAR_HUES[hash % AVATAR_HUES.length] ?? 210;
  const theme = useTheme<AppTheme>();
  const dark = theme.dark;

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius.full,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: `hsl(${hue}, ${dark ? "40%" : "88%"}, ${dark ? "26%" : "92%"})`,
      }}
    >
      <Text
        style={{
          color: `hsl(${hue}, ${dark ? "70%" : "45%"}, ${dark ? "78%" : "34%"})`,
          fontWeight: "700",
          fontSize: size * 0.36,
        }}
      >
        {initials(name)}
      </Text>
    </View>
  );
}

// ── key/value row ───────────────────────────────────────────────────────────

export function DetailRow({
  label,
  value,
  icon,
  onPress,
}: {
  label: string;
  value: ReactNode;
  icon?: string;
  onPress?: () => void;
}) {
  const theme = useTheme<AppTheme>();

  const body = (
    <View style={styles.detailRow}>
      {icon ? <Icon source={icon} size={18} color={theme.colors.onSurfaceVariant} /> : null}
      <Text variant="bodyMedium" style={[styles.flex, { color: theme.colors.onSurfaceVariant }]}>
        {label}
      </Text>
      {typeof value === "string" ? (
        <Text variant="bodyMedium" style={styles.detailValue}>
          {value}
        </Text>
      ) : (
        value
      )}
    </View>
  );

  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} android_ripple={{ color: theme.colors.surfaceVariant }}>
      {body}
    </Pressable>
  );
}

/** Hairline divider that respects the theme. */
export function Divider() {
  const theme = useTheme<AppTheme>();
  return <View style={[styles.divider, { backgroundColor: theme.colors.outlineVariant }]} />;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tileTouch: { borderRadius: radius.lg },
  tile: {
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: 2,
    minHeight: 84,
    justifyContent: "center",
  },
  tileHead: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  tileLabel: { textTransform: "uppercase", flex: 1 },
  statGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  card: {
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  cardHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  cardIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: { padding: spacing.lg, paddingTop: spacing.sm },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: TOUCH_TARGET,
    paddingVertical: spacing.sm,
  },
  detailValue: { fontWeight: "600", textAlign: "right", flexShrink: 1 },
  divider: { height: StyleSheet.hairlineWidth, width: "100%" },
});

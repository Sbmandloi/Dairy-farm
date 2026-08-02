import { type ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { ActivityIndicator, Button, Icon, Text, useTheme } from "react-native-paper";
import { toUserMessage } from "@/api/errors";
import { isOfflineError } from "@/api/query-client";
import { radius, spacing } from "@/theme";
import type { AppTheme } from "@/theme";

/**
 * The three states every data screen has besides "showing data": loading, empty
 * and failed.
 *
 * They are components rather than inline JSX so all fourteen screens present
 * them identically — the same spacing, the same tone of voice, and always with
 * a way forward rather than a dead end.
 */

/**
 * Skeleton placeholder.
 *
 * A shaped skeleton rather than a spinner, because the layout is known in
 * advance: the screen does not reflow when the data lands, which is what makes
 * loading feel fast rather than merely brief.
 */
export function Skeleton({
  height = 16,
  width = "100%",
  style,
}: {
  height?: number;
  width?: number | `${number}%`;
  style?: object;
}) {
  const theme = useTheme<AppTheme>();
  return (
    <View
      style={[
        {
          height,
          width,
          borderRadius: radius.sm,
          backgroundColor: theme.colors.surfaceVariant,
        },
        style,
      ]}
    />
  );
}

/** A stack of card-shaped skeletons, for list screens. */
export function ListSkeleton({ rows = 6, cardHeight = 76 }: { rows?: number; cardHeight?: number }) {
  return (
    <View style={styles.skeletonList}>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} height={cardHeight} style={{ borderRadius: radius.lg }} />
      ))}
    </View>
  );
}

/** Skeletons matching the summary tile row that heads most screens. */
export function StatsSkeleton({ tiles = 4 }: { tiles?: number }) {
  return (
    <View style={styles.skeletonGrid}>
      {Array.from({ length: tiles }, (_, i) => (
        <Skeleton key={i} height={84} width="48%" style={{ borderRadius: radius.lg }} />
      ))}
    </View>
  );
}

export function CenteredLoader({ label }: { label?: string }) {
  const theme = useTheme<AppTheme>();
  return (
    <View style={styles.centered}>
      <ActivityIndicator size="large" />
      {label ? (
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: spacing.md }}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  const theme = useTheme<AppTheme>();
  return (
    <View style={styles.centered}>
      <View
        style={[
          styles.emptyIcon,
          { backgroundColor: theme.colors.surfaceVariant },
        ]}
      >
        <Icon source={icon} size={32} color={theme.colors.onSurfaceVariant} />
      </View>
      <Text variant="titleMedium" style={styles.emptyTitle}>
        {title}
      </Text>
      {description ? (
        <Text
          variant="bodyMedium"
          style={[styles.emptyBody, { color: theme.colors.onSurfaceVariant }]}
        >
          {description}
        </Text>
      ) : null}
      {action ? <View style={{ marginTop: spacing.lg }}>{action}</View> : null}
    </View>
  );
}

/**
 * Failure state.
 *
 * Offline is distinguished from a real error because the remedy is different:
 * one is "turn your data on", the other is "try again or tell someone". Showing
 * a generic "something went wrong" for a subway tunnel wastes the user's time.
 */
export function ErrorState({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry?: () => void;
}) {
  const theme = useTheme<AppTheme>();
  const offline = isOfflineError(error);

  return (
    <View style={styles.centered}>
      <View
        style={[
          styles.emptyIcon,
          { backgroundColor: theme.colors.errorContainer },
        ]}
      >
        <Icon
          source={offline ? "wifi-off" : "alert-circle-outline"}
          size={32}
          color={theme.colors.onErrorContainer}
        />
      </View>
      <Text variant="titleMedium" style={styles.emptyTitle}>
        {offline ? "You're offline" : "Couldn't load this"}
      </Text>
      <Text
        variant="bodyMedium"
        style={[styles.emptyBody, { color: theme.colors.onSurfaceVariant }]}
      >
        {offline
          ? "Check your mobile data or wifi, then try again."
          : toUserMessage(error)}
      </Text>
      {onRetry ? (
        <Button mode="contained-tonal" onPress={onRetry} style={{ marginTop: spacing.lg }} icon="refresh">
          Try again
        </Button>
      ) : null}
    </View>
  );
}

/** Wraps an error state so it can still be pulled-to-refresh on a full screen. */
export function ErrorScreen({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <ScrollView contentContainerStyle={styles.fill}>
      <ErrorState error={error} onRetry={onRetry} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flexGrow: 1 },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    minHeight: 280,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  emptyTitle: { textAlign: "center" },
  emptyBody: { textAlign: "center", marginTop: spacing.xs, maxWidth: 320 },
  skeletonList: { gap: spacing.md, padding: spacing.lg },
  skeletonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    justifyContent: "space-between",
  },
});

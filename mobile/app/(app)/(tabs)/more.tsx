import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import {
  Avatar,
  Button,
  Dialog,
  Icon,
  Portal,
  Text,
  TouchableRipple,
  useTheme,
} from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/auth/auth-context";
import { useNetwork } from "@/hooks/use-network";
import { useSettings } from "@/hooks/queries";
import { Divider, SectionCard } from "@/components/ui";
import { env } from "@/config/env";
import { radius, spacing } from "@/theme";
import type { AppTheme } from "@/theme";
import { initials } from "@/utils/format";

/**
 * More — the destinations that do not earn a permanent tab.
 *
 * The web sidebar has nine entries; five are daily work and live in the tab bar,
 * and these four are occasional. Grouping them here keeps the bottom bar within
 * thumb reach instead of cramming nine 40dp targets across a phone.
 */

interface Destination {
  href: string;
  title: string;
  description: string;
  icon: string;
}

const DESTINATIONS: Destination[] = [
  {
    href: "/manager",
    title: "Customer manager",
    description: "Dues, collections and WhatsApp reminders",
    icon: "account-cash-outline",
  },
  {
    href: "/monthly",
    title: "Monthly view",
    description: "The whole month, customer by day",
    icon: "calendar-month-outline",
  },
  {
    href: "/quick-bill",
    title: "Quick bill",
    description: "Bill one customer across several months",
    icon: "flash-outline",
  },
  {
    href: "/reports",
    title: "Reports & backup",
    description: "Trends, best customers and data exports",
    icon: "chart-box-outline",
  },
];

export default function MoreScreen() {
  const theme = useTheme<AppTheme>();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const network = useNetwork();
  const { data: settings } = useSettings();

  const [confirmSignOut, setConfirmSignOut] = useState(false);

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
    >
      {/* Who is signed in, and to which dairy. */}
      <SectionCard>
        <View style={styles.profile}>
          <Avatar.Text size={52} label={initials(user?.name ?? "?")} />
          <View style={styles.flex}>
            <Text variant="titleMedium" numberOfLines={1}>
              {user?.name ?? "Signed in"}
            </Text>
            <Text
              variant="bodySmall"
              numberOfLines={1}
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              {user?.email}
            </Text>
            {settings ? (
              <Text
                variant="labelSmall"
                numberOfLines={1}
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                {settings.farmName}
              </Text>
            ) : null}
          </View>
        </View>
      </SectionCard>

      <SectionCard padded={false}>
        {DESTINATIONS.map((item, index) => (
          <View key={item.href}>
            {index > 0 ? <Divider /> : null}
            <TouchableRipple onPress={() => router.push(item.href as never)}>
              <View style={styles.linkRow}>
                <View style={[styles.linkIcon, { backgroundColor: theme.colors.primaryContainer }]}>
                  <Icon source={item.icon} size={20} color={theme.colors.onPrimaryContainer} />
                </View>
                <View style={styles.flex}>
                  <Text variant="bodyLarge" style={styles.semibold}>
                    {item.title}
                  </Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    {item.description}
                  </Text>
                </View>
                <Icon source="chevron-right" size={22} color={theme.colors.onSurfaceVariant} />
              </View>
            </TouchableRipple>
          </View>
        ))}
      </SectionCard>

      <SectionCard padded={false}>
        <TouchableRipple onPress={() => router.push("/settings")}>
          <View style={styles.linkRow}>
            <View style={[styles.linkIcon, { backgroundColor: theme.colors.secondaryContainer }]}>
              <Icon source="cog-outline" size={20} color={theme.colors.onSecondaryContainer} />
            </View>
            <View style={styles.flex}>
              <Text variant="bodyLarge" style={styles.semibold}>
                Settings
              </Text>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                Farm details, rate, entry mode, WhatsApp, users
              </Text>
            </View>
            {/* WhatsApp being unconfigured silently breaks bill delivery, so it
                is surfaced here rather than only inside Settings. */}
            {settings && !settings.whatsappConfigured ? (
              <Icon source="alert-circle" size={20} color={theme.colors.error} />
            ) : (
              <Icon source="chevron-right" size={22} color={theme.colors.onSurfaceVariant} />
            )}
          </View>
        </TouchableRipple>
      </SectionCard>

      <Button
        mode="outlined"
        icon="logout"
        textColor={theme.colors.error}
        onPress={() => setConfirmSignOut(true)}
        style={styles.signOut}
      >
        Sign out
      </Button>

      <View style={styles.footer}>
        <View style={styles.connection}>
          <Icon
            source={network.isOnline ? "wifi-check" : "wifi-off"}
            size={14}
            color={network.isOnline ? theme.dairy.paid.onContainer : theme.colors.error}
          />
          <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {network.isOnline ? `Connected (${network.type})` : "Offline"}
          </Text>
        </View>
        <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
          Dairy Billing 1.0.0
        </Text>
        <Text
          variant="labelSmall"
          numberOfLines={1}
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          {env.apiUrl.replace(/^https?:\/\//, "")}
        </Text>
      </View>

      <Portal>
        <Dialog visible={confirmSignOut} onDismiss={() => setConfirmSignOut(false)}>
          <Dialog.Icon icon="logout" />
          <Dialog.Title style={styles.dialogTitle}>Sign out?</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              You will need your email and password to sign back in. Nothing is deleted.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setConfirmSignOut(false)}>Cancel</Button>
            <Button
              mode="contained"
              buttonColor={theme.colors.error}
              onPress={() => {
                setConfirmSignOut(false);
                void signOut();
              }}
            >
              Sign out
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
  profile: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
  },
  linkIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  signOut: { borderRadius: radius.full },
  footer: { alignItems: "center", gap: 2, marginTop: spacing.md },
  connection: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  dialogTitle: { textAlign: "center" },
});

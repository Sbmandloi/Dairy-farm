import { useEffect } from "react";
import { Redirect, Stack } from "expo-router";
import { useTheme } from "react-native-paper";
import { clearCache } from "@/api/query-client";
import { useAuth } from "@/auth/auth-context";
import type { AppTheme } from "@/theme";

/**
 * The authenticated area.
 *
 * Everything below this layout requires a session. Guarding here rather than in
 * each screen means a token expiring mid-use bounces the user to login from
 * wherever they are, and there is no route that can accidentally be left open.
 */
export default function AppLayout() {
  const theme = useTheme<AppTheme>();
  const { status } = useAuth();

  // A signed-out session must not leave the previous account's customers,
  // balances or payment history sitting in the query cache.
  useEffect(() => {
    if (status === "unauthenticated") clearCache();
  }, [status]);

  if (status === "loading") return null;
  if (status === "unauthenticated") return <Redirect href="/login" />;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.surface },
        headerTintColor: theme.colors.onSurface,
        headerTitleStyle: { fontWeight: "600" },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: theme.colors.background },
        // Android's own forward/back transition, so navigation feels native
        // rather than like a web page swap.
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="customer/new" options={{ title: "New customer" }} />
      <Stack.Screen name="customer/[id]/index" options={{ title: "Customer" }} />
      <Stack.Screen name="customer/[id]/edit" options={{ title: "Edit customer" }} />
      <Stack.Screen name="bill/[id]" options={{ title: "Bill" }} />
      <Stack.Screen name="manager" options={{ title: "Customer manager" }} />
      <Stack.Screen name="monthly" options={{ title: "Monthly view" }} />
      <Stack.Screen name="quick-bill" options={{ title: "Quick bill" }} />
      <Stack.Screen name="reports" options={{ title: "Reports" }} />
      <Stack.Screen name="settings" options={{ title: "Settings" }} />
    </Stack>
  );
}

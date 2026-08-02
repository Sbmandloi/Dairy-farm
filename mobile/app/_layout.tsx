import { useEffect } from "react";
import { StyleSheet, useColorScheme, View } from "react-native";
import { Slot, SplashScreen } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { PaperProvider, Text, useTheme } from "react-native-paper";
import { QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";

import { queryClient } from "@/api/query-client";
import { AuthProvider } from "@/auth/auth-context";
import { FeedbackProvider } from "@/components/feedback";
import { startNetworkMonitor } from "@/hooks/use-network";
import { describeEnvProblem } from "@/config/env";
import { darkTheme, lightTheme, spacing } from "@/theme";
import type { AppTheme } from "@/theme";

/**
 * Root layout — every provider the app needs, in dependency order.
 *
 * GestureHandler must be outermost for Reanimated gestures to work at all;
 * SafeArea and Paper wrap the visual tree; the query client sits above auth so
 * that signing out can clear the cache; feedback is innermost so any screen can
 * raise a snackbar.
 */

// Hold the native splash until the first frame is ready, so the app never
// flashes a blank screen between the splash and the dashboard.
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? darkTheme : lightTheme;

  useEffect(() => {
    // Paint the window background before React mounts, so rotating or opening
    // the recents view never shows a white flash in dark mode.
    void SystemUI.setBackgroundColorAsync(theme.colors.background);
  }, [theme]);

  useEffect(() => startNetworkMonitor(), []);

  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);

  const envProblem = describeEnvProblem();

  return (
    <GestureHandlerRootView style={styles.fill}>
      <SafeAreaProvider>
        <PaperProvider theme={theme}>
          <StatusBar style={scheme === "dark" ? "light" : "dark"} />
          {envProblem ? (
            <MisconfiguredBuild title={envProblem.title} detail={envProblem.detail} />
          ) : (
            <QueryClientProvider client={queryClient}>
              <AuthProvider>
                <FeedbackProvider>
                  <Slot />
                </FeedbackProvider>
              </AuthProvider>
            </QueryClientProvider>
          )}
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Shown instead of the app when the APK was built without a usable server
 * address. There is nothing the user can do in-app to fix it, so this states
 * plainly what is wrong and who needs to act, rather than failing later as a
 * stream of network errors.
 */
function MisconfiguredBuild({ title, detail }: { title: string; detail: string }) {
  const theme = useTheme<AppTheme>();
  return (
    <View style={[styles.problem, { backgroundColor: theme.colors.background }]}>
      <Text variant="headlineSmall" style={styles.problemTitle}>
        {title}
      </Text>
      <Text
        variant="bodyMedium"
        style={[styles.problemBody, { color: theme.colors.onSurfaceVariant }]}
      >
        {detail}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  problem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  problemTitle: { textAlign: "center" },
  problemBody: { textAlign: "center", marginTop: spacing.md, maxWidth: 320 },
});

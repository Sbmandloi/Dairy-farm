import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Redirect } from "expo-router";
import { Button, HelperText, Surface, Text, TextInput, useTheme } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ApiError, toUserMessage } from "@/api/errors";
import { useAuth } from "@/auth/auth-context";
import { env } from "@/config/env";
import { radius, spacing } from "@/theme";
import type { AppTheme } from "@/theme";

/**
 * Sign in.
 *
 * Same credentials as the web app — this is the same user table, checked the
 * same way. The screen deliberately has nothing else on it: no sign-up, no
 * password reset, because neither exists in this product. Accounts are created
 * by an existing user on the Settings screen.
 */
export default function LoginScreen() {
  const theme = useTheme<AppTheme>();
  const insets = useSafeAreaInsets();
  const { status, signIn } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (status === "authenticated") return <Redirect href="/dashboard" />;

  const canSubmit = email.trim().length > 0 && password.length > 0 && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setError("");
    setSubmitting(true);
    try {
      await signIn(email, password);
      // Navigation is handled by the redirect above once status flips.
    } catch (e) {
      // A wrong password is the expected case and its message is already
      // user-facing; anything else is translated by toUserMessage.
      setError(e instanceof ApiError ? e.message : toUserMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.fill, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brand}>
          <View style={[styles.logo, { backgroundColor: theme.colors.primary }]}>
            <Text style={styles.logoGlyph}>🥛</Text>
          </View>
          <Text variant="headlineSmall" style={styles.brandName}>
            Dairy Billing
          </Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            Milk delivery, billing & invoicing
          </Text>
        </View>

        <Surface elevation={1} style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <Text variant="titleMedium">Sign in</Text>
          <Text
            variant="bodySmall"
            style={[styles.cardHint, { color: theme.colors.onSurfaceVariant }]}
          >
            Use the same email and password as the website.
          </Text>

          <TextInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            mode="outlined"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            left={<TextInput.Icon icon="email-outline" />}
            style={styles.field}
            disabled={submitting}
            onSubmitEditing={handleSubmit}
          />

          <TextInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            mode="outlined"
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoComplete="current-password"
            textContentType="password"
            left={<TextInput.Icon icon="lock-outline" />}
            right={
              <TextInput.Icon
                icon={showPassword ? "eye-off-outline" : "eye-outline"}
                onPress={() => setShowPassword((prev) => !prev)}
                accessibilityLabel={showPassword ? "Hide password" : "Show password"}
              />
            }
            style={styles.field}
            disabled={submitting}
            onSubmitEditing={handleSubmit}
          />

          <HelperText type="error" visible={Boolean(error)} style={styles.error}>
            {error}
          </HelperText>

          <Button
            mode="contained"
            onPress={handleSubmit}
            disabled={!canSubmit}
            loading={submitting}
            style={styles.submit}
            contentStyle={styles.submitContent}
          >
            {submitting ? "Signing in…" : "Sign in"}
          </Button>
        </Surface>

        {/* Which server this build talks to matters when several APKs exist
            (a test build and the client's). Shown only for local builds so the
            production app stays clean. */}
        {env.isLocal ? (
          <Text
            variant="labelSmall"
            style={[styles.server, { color: theme.colors.onSurfaceVariant }]}
          >
            {env.apiUrl}
          </Text>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: "center", padding: spacing.xl },
  brand: { alignItems: "center", marginBottom: spacing.xxl },
  logo: {
    width: 68,
    height: 68,
    borderRadius: radius.xl,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  logoGlyph: { fontSize: 34 },
  brandName: { fontWeight: "700" },
  card: { borderRadius: radius.lg, padding: spacing.xl },
  cardHint: { marginTop: 2, marginBottom: spacing.lg },
  field: { marginBottom: spacing.sm },
  error: { marginBottom: spacing.xs },
  submit: { borderRadius: radius.full, marginTop: spacing.xs },
  submitContent: { height: 52 },
  server: { textAlign: "center", marginTop: spacing.xl },
});

import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import {
  Button,
  Dialog,
  HelperText,
  Icon,
  Portal,
  SegmentedButtons,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useCreateUser,
  useDeleteUser,
  useSettings,
  useUpdateSettings,
  useUsers,
} from "@/hooks/queries";
import { useFeedback } from "@/components/feedback";
import { CenteredLoader, ErrorScreen } from "@/components/states";
import { Divider, SectionCard } from "@/components/ui";
import { radius, spacing } from "@/theme";
import type { AppTheme } from "@/theme";
import { formatDate } from "@/utils/format";
import type { AppUser, EntryMode } from "@/api/types";

/**
 * Settings — farm details, the global rate, how entries are recorded, WhatsApp,
 * and who can sign in.
 *
 * The WhatsApp access token is write-only: the server never sends it back, only
 * whether one is configured. Leaving that field blank keeps the stored token, so
 * the farm's name can be corrected on the phone without the credential ever
 * being on the device.
 */
export default function SettingsScreen() {
  const theme = useTheme<AppTheme>();
  const insets = useSafeAreaInsets();
  const feedback = useFeedback();

  const settings = useSettings();
  const update = useUpdateSettings();

  const [farmName, setFarmName] = useState("");
  const [farmAddress, setFarmAddress] = useState("");
  const [farmPhone, setFarmPhone] = useState("");
  const [rate, setRate] = useState("");
  const [entryMode, setEntryMode] = useState<EntryMode>("SPLIT");
  const [instanceId, setInstanceId] = useState("");
  const [apiToken, setApiToken] = useState("");

  /**
   * Seed the form once the settings arrive.
   *
   * Only once: a background refetch must never overwrite what the user is
   * currently typing. Done during render rather than in an effect so the fields
   * are never briefly empty after the data has loaded.
   */
  const [seeded, setSeeded] = useState(false);
  if (settings.data && !seeded) {
    setSeeded(true);
    setFarmName(settings.data.farmName);
    setFarmAddress(settings.data.farmAddress ?? "");
    setFarmPhone(settings.data.farmPhone ?? "");
    setRate(String(settings.data.globalPricePerLiter));
    setEntryMode(settings.data.entryMode);
    setInstanceId(settings.data.whatsappPhoneNumberId ?? "");
  }

  if (settings.isLoading) return <CenteredLoader label="Loading settings…" />;
  if (settings.isError || !settings.data) {
    return <ErrorScreen error={settings.error} onRetry={() => void settings.refetch()} />;
  }

  const rateValue = parseFloat(rate);
  const rateInvalid = Number.isNaN(rateValue) || rateValue <= 0;
  const nameInvalid = farmName.trim().length < 2;

  async function handleSave() {
    if (nameInvalid || rateInvalid) return;
    try {
      await update.mutateAsync({
        farmName: farmName.trim(),
        farmAddress: farmAddress.trim() || undefined,
        farmPhone: farmPhone.trim() || undefined,
        globalPricePerLiter: rate,
        billingCycleType: "MONTHLY",
        entryMode,
        whatsappPhoneNumberId: instanceId.trim() || undefined,
        // Blank means "leave the stored token alone" — the server deletes the
        // key rather than overwriting with an empty value.
        whatsappAccessToken: apiToken.trim() || undefined,
      });
      setApiToken("");
      feedback.success("Settings saved.");
    } catch (e) {
      feedback.error(e);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
        keyboardShouldPersistTaps="handled"
      >
        <SectionCard title="Farm details" subtitle="Printed on every bill" icon="home-outline">
          <TextInput
            label="Farm name *"
            value={farmName}
            onChangeText={setFarmName}
            mode="outlined"
            error={nameInvalid && farmName.length > 0}
          />
          <HelperText type="error" visible={nameInvalid && farmName.length > 0}>
            Farm name is required
          </HelperText>

          <TextInput
            label="Address"
            value={farmAddress}
            onChangeText={setFarmAddress}
            mode="outlined"
            multiline
            numberOfLines={2}
          />
          <TextInput
            label="Phone"
            value={farmPhone}
            onChangeText={setFarmPhone}
            mode="outlined"
            keyboardType="phone-pad"
            style={styles.spaced}
          />
        </SectionCard>

        <SectionCard title="Billing" icon="cash">
          <TextInput
            label="Global rate per litre *"
            value={rate}
            onChangeText={(text) => setRate(text.replace(/[^0-9.]/g, ""))}
            mode="outlined"
            keyboardType="decimal-pad"
            left={<TextInput.Icon icon="currency-inr" />}
            error={rateInvalid && rate.length > 0}
          />
          <HelperText type={rateInvalid && rate.length > 0 ? "error" : "info"} visible>
            {rateInvalid && rate.length > 0
              ? "Rate must be greater than 0"
              : "Used for every customer without their own rate."}
          </HelperText>

          <Text variant="bodyMedium" style={styles.label}>
            How milk is recorded
          </Text>
          <SegmentedButtons
            value={entryMode}
            onValueChange={(value) => setEntryMode(value as EntryMode)}
            buttons={[
              { value: "SPLIT", label: "Morning + evening", icon: "weather-sunset" },
              { value: "SINGLE", label: "One total", icon: "numeric-1-circle-outline" },
            ]}
          />
          <HelperText type="info" visible>
            Changes what the daily entry screen asks for. Existing entries are not affected.
          </HelperText>

          <View style={[styles.cycleNote, { backgroundColor: theme.colors.surfaceVariant }]}>
            <Icon source="calendar-month-outline" size={16} color={theme.colors.onSurfaceVariant} />
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, flex: 1 }}>
              Billing runs monthly, from the 1st to the last day of the month.
            </Text>
          </View>
        </SectionCard>

        <SectionCard
          title="WhatsApp (Green API)"
          subtitle={
            settings.data.whatsappConfigured
              ? "Connected — bills and reminders can be sent"
              : "Not set up — bills cannot be sent"
          }
          icon="whatsapp"
        >
          <View
            style={[
              styles.status,
              {
                backgroundColor: settings.data.whatsappConfigured
                  ? theme.dairy.paid.container
                  : theme.dairy.partial.container,
              },
            ]}
          >
            <Icon
              source={settings.data.whatsappConfigured ? "check-circle" : "alert-circle-outline"}
              size={18}
              color={
                settings.data.whatsappConfigured
                  ? theme.dairy.paid.onContainer
                  : theme.dairy.partial.onContainer
              }
            />
            <Text
              variant="bodySmall"
              style={{
                flex: 1,
                color: settings.data.whatsappConfigured
                  ? theme.dairy.paid.onContainer
                  : theme.dairy.partial.onContainer,
              }}
            >
              {settings.data.whatsappConfigured
                ? "An API token is saved. Leave the token field blank to keep it."
                : "Add your Green API instance ID and token to send bills."}
            </Text>
          </View>

          <TextInput
            label="Instance ID"
            value={instanceId}
            onChangeText={setInstanceId}
            mode="outlined"
            autoCapitalize="none"
            style={styles.spaced}
          />
          <TextInput
            label="API token"
            value={apiToken}
            onChangeText={setApiToken}
            mode="outlined"
            autoCapitalize="none"
            secureTextEntry
            placeholder={settings.data.whatsappConfigured ? "•••••••• (unchanged)" : ""}
            style={styles.spaced}
          />
          <HelperText type="info" visible>
            The saved token is never sent back to this device. Enter a new one only to replace it.
          </HelperText>
        </SectionCard>

        <Button
          mode="contained"
          onPress={handleSave}
          loading={update.isPending}
          disabled={update.isPending || nameInvalid || rateInvalid}
          style={styles.save}
          contentStyle={styles.saveContent}
        >
          Save settings
        </Button>

        <UsersSection />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Who can sign in — the same accounts the web Settings page manages. */
function UsersSection() {
  const theme = useTheme<AppTheme>();
  const feedback = useFeedback();

  const users = useUsers();
  const createUser = useCreateUser();
  const deleteUser = useDeleteUser();

  const [addOpen, setAddOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<AppUser | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleCreate() {
    try {
      await createUser.mutateAsync({ name: name.trim(), email: email.trim(), password });
      setAddOpen(false);
      setName("");
      setEmail("");
      setPassword("");
      feedback.success("User added — they can sign in on the app or the website.");
    } catch (e) {
      feedback.error(e);
    }
  }

  const canCreate = name.trim().length > 0 && email.trim().length > 0 && password.length >= 6;

  return (
    <>
      <SectionCard
        title="Users"
        subtitle="Who can sign in to this dairy"
        icon="account-key-outline"
        padded={false}
        action={
          <Button compact icon="plus" onPress={() => setAddOpen(true)}>
            Add
          </Button>
        }
      >
        {users.isLoading ? (
          <CenteredLoader />
        ) : (
          (users.data ?? []).map((user, index) => (
            <View key={user.id}>
              {index > 0 ? <Divider /> : null}
              <View style={styles.userRow}>
                <View style={[styles.userIcon, { backgroundColor: theme.colors.primaryContainer }]}>
                  <Icon source="account" size={18} color={theme.colors.onPrimaryContainer} />
                </View>
                <View style={styles.flex}>
                  <Text variant="bodyMedium" style={styles.semibold}>
                    {user.name}
                    {user.isCurrentUser ? " (you)" : ""}
                  </Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    {user.email}
                  </Text>
                  <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    Added {formatDate(user.createdAt.slice(0, 10))}
                  </Text>
                </View>
                {/* You cannot delete yourself, and the server refuses to remove
                    the last account — both would lock everyone out. */}
                {!user.isCurrentUser ? (
                  <Button
                    compact
                    textColor={theme.colors.error}
                    onPress={() => setConfirmDelete(user)}
                  >
                    Remove
                  </Button>
                ) : null}
              </View>
            </View>
          ))
        )}
      </SectionCard>

      <Portal>
        <Dialog visible={addOpen} onDismiss={() => setAddOpen(false)}>
          <Dialog.Title>Add a user</Dialog.Title>
          <Dialog.Content>
            <TextInput label="Name" value={name} onChangeText={setName} mode="outlined" />
            <TextInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              mode="outlined"
              autoCapitalize="none"
              keyboardType="email-address"
              style={styles.spaced}
            />
            <TextInput
              label="Password"
              value={password}
              onChangeText={setPassword}
              mode="outlined"
              secureTextEntry
              autoCapitalize="none"
              style={styles.spaced}
            />
            <HelperText type={password.length > 0 && password.length < 6 ? "error" : "info"} visible>
              At least 6 characters.
            </HelperText>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setAddOpen(false)}>Cancel</Button>
            <Button
              mode="contained"
              onPress={handleCreate}
              loading={createUser.isPending}
              disabled={!canCreate || createUser.isPending}
            >
              Add
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={confirmDelete !== null} onDismiss={() => setConfirmDelete(null)}>
          <Dialog.Icon icon="account-remove-outline" />
          <Dialog.Title style={styles.dialogTitle}>Remove {confirmDelete?.name}?</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              They will no longer be able to sign in on the app or the website. Nothing they
              recorded is deleted.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setConfirmDelete(null)}>Cancel</Button>
            <Button
              mode="contained"
              buttonColor={theme.colors.error}
              loading={deleteUser.isPending}
              onPress={async () => {
                const target = confirmDelete;
                setConfirmDelete(null);
                if (!target) return;
                try {
                  await deleteUser.mutateAsync(target.id);
                  feedback.success(`${target.name} removed.`);
                } catch (e) {
                  feedback.error(e);
                }
              }}
            >
              Remove
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1 },
  semibold: { fontWeight: "600" },
  content: { padding: spacing.lg, gap: spacing.lg },
  spaced: { marginTop: spacing.sm },
  label: { marginTop: spacing.sm, marginBottom: spacing.sm },
  cycleNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    marginTop: spacing.sm,
  },
  status: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  save: { borderRadius: radius.full },
  saveContent: { height: 52 },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
  },
  userIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  dialogTitle: { textAlign: "center" },
});

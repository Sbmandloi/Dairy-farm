import { useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  Button,
  Dialog,
  HelperText,
  Icon,
  Portal,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBill, useMarkBillPaid, useSendBillWhatsApp } from "@/hooks/queries";
import { billPdfPath } from "@/api/endpoints";
import { sharePdf } from "@/utils/download";
import { useFeedback } from "@/components/feedback";
import { CenteredLoader, ErrorScreen } from "@/components/states";
import {
  BillStatusChip,
  CustomerAvatar,
  DetailRow,
  Divider,
  Money,
  SectionCard,
} from "@/components/ui";
import { radius, spacing } from "@/theme";
import type { AppTheme } from "@/theme";
import { today } from "@/utils/date";
import { formatCurrency, formatDate, formatLiters, formatPeriod } from "@/utils/format";

/**
 * One bill: what it covers, what is owed, and the three things you can do with
 * it — share the PDF, send it on WhatsApp, or record a payment against it.
 *
 * The PDF is not rendered in-app. It is the same server-rendered document the
 * web downloads (Devanagari fonts and all), handed to Android's share sheet so
 * the farmer can print it, save it to Drive, or forward it — all of which the
 * system already does better than a bundled viewer would.
 */
export default function BillDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme<AppTheme>();
  const insets = useSafeAreaInsets();
  const feedback = useFeedback();

  const { data, isLoading, isError, error, refetch, isRefetching } = useBill(id);
  const markPaid = useMarkBillPaid(id);
  const sendWhatsApp = useSendBillWhatsApp(id);

  const [payOpen, setPayOpen] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);
  const [sharing, setSharing] = useState(false);

  if (isLoading) return <CenteredLoader label="Loading bill…" />;
  if (isError || !data) return <ErrorScreen error={error} onRetry={() => void refetch()} />;

  const settled = data.due <= 0.01;

  async function handleShare() {
    setSharing(true);
    try {
      await sharePdf(billPdfPath(id), `${data!.invoiceNumber}.pdf`, "Share or print this bill");
    } catch (e) {
      feedback.error(e);
    } finally {
      setSharing(false);
    }
  }

  async function handleSend() {
    setConfirmSend(false);
    try {
      await sendWhatsApp.mutateAsync();
      feedback.success(`Bill sent to ${data!.customer.name} on WhatsApp.`);
    } catch (e) {
      feedback.error(e);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />}
    >
      {/* The headline number is what is still owed, not the gross total —
          that is the figure the farmer is acting on. */}
      <View
        style={[
          styles.hero,
          { backgroundColor: settled ? theme.dairy.settled.container : theme.dairy.due.container },
        ]}
      >
        <Text
          variant="labelMedium"
          style={{
            color: settled ? theme.dairy.settled.onContainer : theme.dairy.due.onContainer,
          }}
        >
          {settled ? "FULLY PAID" : "STILL DUE"}
        </Text>
        <Text
          variant="displaySmall"
          style={{
            color: settled ? theme.dairy.settled.onContainer : theme.dairy.due.onContainer,
            fontWeight: "700",
          }}
        >
          {formatCurrency(settled ? data.totalAmount : data.due)}
        </Text>
        {!settled && data.paid > 0.01 ? (
          <Text variant="bodySmall" style={{ color: theme.dairy.due.onContainer }}>
            {formatCurrency(data.paid)} of {formatCurrency(data.totalAmount)} already collected
          </Text>
        ) : null}
        <View style={styles.heroStatus}>
          <BillStatusChip status={data.status} />
        </View>
      </View>

      <SectionCard>
        <View style={styles.customer}>
          <CustomerAvatar name={data.customer.name} size={48} />
          <View style={styles.flex}>
            <Text variant="titleMedium" numberOfLines={1}>
              {data.customer.name}
            </Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {data.invoiceNumber}
            </Text>
          </View>
          <Button compact onPress={() => router.push(`/customer/${data.customerId}`)}>
            View
          </Button>
        </View>
      </SectionCard>

      <SectionCard title="What this bill covers" icon="file-document-outline">
        <DetailRow
          label="Period"
          value={formatPeriod(data.periodStart, data.periodEnd)}
          icon="calendar-range"
        />
        <Divider />
        <DetailRow label="Quantity" value={formatLiters(data.totalLiters)} icon="water-outline" />
        <Divider />
        <DetailRow
          label="Rate"
          value={`${formatCurrency(data.pricePerLiter)} / litre`}
          icon="tag-outline"
        />
        <Divider />
        <DetailRow
          label="Total"
          value={<Money amount={data.totalAmount} variant="titleSmall" />}
          icon="sigma"
        />
        <Divider />
        <DetailRow
          label="Collected"
          value={<Money amount={data.paid} tone="paid" variant="titleSmall" />}
          icon="check-circle-outline"
        />
        {data.sentAt ? (
          <>
            <Divider />
            <DetailRow
              label="Sent"
              value={formatDate(data.sentAt.slice(0, 10))}
              icon="whatsapp"
            />
          </>
        ) : null}
      </SectionCard>

      <View style={styles.actions}>
        {!settled ? (
          <Button
            mode="contained"
            icon="cash-plus"
            onPress={() => setPayOpen(true)}
            style={styles.action}
            contentStyle={styles.actionContent}
          >
            Record payment
          </Button>
        ) : null}

        <View style={styles.actionRow}>
          <Button
            mode="contained-tonal"
            icon="share-variant-outline"
            onPress={handleShare}
            loading={sharing}
            disabled={sharing}
            style={styles.flex}
          >
            Share PDF
          </Button>
          <Button
            mode="contained-tonal"
            icon="whatsapp"
            onPress={() => setConfirmSend(true)}
            loading={sendWhatsApp.isPending}
            disabled={sendWhatsApp.isPending || !data.customer.phoneNumber}
            style={styles.flex}
          >
            Send
          </Button>
        </View>

        {!data.customer.phoneNumber ? (
          <HelperText type="info" visible>
            {data.customer.name} has no phone number, so this bill cannot be sent on WhatsApp.
          </HelperText>
        ) : null}
      </View>

      {data.payments.length > 0 ? (
        <SectionCard
          title="Payments against this bill"
          subtitle={`${data.payments.length} recorded`}
          icon="cash-multiple"
          padded={false}
        >
          {data.payments.map((payment, index) => (
            <View key={payment.id}>
              {index > 0 ? <Divider /> : null}
              <View style={styles.paymentRow}>
                <Icon source="arrow-down-circle" size={20} color={theme.dairy.paid.onContainer} />
                <View style={styles.flex}>
                  <Text variant="bodyMedium">{formatDate(payment.paidOn)}</Text>
                  {payment.note ? (
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                      {payment.note}
                    </Text>
                  ) : null}
                </View>
                <Money amount={payment.amountPaid} tone="paid" variant="titleSmall" />
              </View>
            </View>
          ))}
        </SectionCard>
      ) : null}

      <RecordPaymentDialog
        visible={payOpen}
        due={data.due}
        invoiceNumber={data.invoiceNumber}
        submitting={markPaid.isPending}
        onDismiss={() => setPayOpen(false)}
        onSubmit={async (amount, paidOn, note) => {
          try {
            await markPaid.mutateAsync({ amountPaid: amount, paidOn, note });
            setPayOpen(false);
            feedback.success(`${formatCurrency(amount)} recorded.`);
          } catch (e) {
            feedback.error(e);
          }
        }}
      />

      <Portal>
        <Dialog visible={confirmSend} onDismiss={() => setConfirmSend(false)}>
          <Dialog.Icon icon="whatsapp" />
          <Dialog.Title style={styles.dialogTitle}>Send this bill?</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              {data.customer.name} will receive the PDF invoice on WhatsApp, showing{" "}
              {formatCurrency(data.due)} due. The bill will be marked as sent.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setConfirmSend(false)}>Cancel</Button>
            <Button mode="contained" onPress={handleSend} loading={sendWhatsApp.isPending}>
              Send
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}

/**
 * Record a payment against this one bill.
 *
 * Pre-filled with the full balance, because paying in full is the common case
 * and typing an amount on a phone is the slow part. The server still enforces
 * that the amount cannot exceed what is owed.
 */
function RecordPaymentDialog({
  visible,
  due,
  invoiceNumber,
  submitting,
  onDismiss,
  onSubmit,
}: {
  visible: boolean;
  due: number;
  invoiceNumber: string;
  submitting: boolean;
  onDismiss: () => void;
  onSubmit: (amount: number, paidOn: string, note?: string) => Promise<void>;
}) {
  const [amount, setAmount] = useState(String(due.toFixed(2)));
  const [paidOn, setPaidOn] = useState(today());
  const [note, setNote] = useState("");

  // Reset to the current balance each time the dialog is opened.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setAmount(String(due.toFixed(2)));
      setPaidOn(today());
      setNote("");
    }
  }

  const parsed = parseFloat(amount);
  const invalid = Number.isNaN(parsed) || parsed <= 0;
  const overpay = !invalid && parsed - due > 0.01;

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss}>
        <Dialog.Title>Record payment</Dialog.Title>
        <Dialog.Content>
          <Text variant="bodySmall" style={styles.dialogHint}>
            Against {invoiceNumber} · {formatCurrency(due)} outstanding
          </Text>

          <TextInput
            label="Amount received"
            value={amount}
            onChangeText={(text) => setAmount(text.replace(/[^0-9.]/g, ""))}
            mode="outlined"
            keyboardType="decimal-pad"
            left={<TextInput.Icon icon="currency-inr" />}
            error={overpay}
          />
          <HelperText type={overpay ? "error" : "info"} visible>
            {overpay
              ? `That is more than the ${formatCurrency(due)} outstanding.`
              : "Tap to change if they paid part of it."}
          </HelperText>

          <TextInput
            label="Paid on"
            value={paidOn}
            onChangeText={setPaidOn}
            mode="outlined"
            placeholder="YYYY-MM-DD"
            left={<TextInput.Icon icon="calendar-outline" />}
          />

          <TextInput
            label="Note (optional)"
            value={note}
            onChangeText={setNote}
            mode="outlined"
            style={styles.noteField}
          />
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss}>Cancel</Button>
          <Button
            mode="contained"
            loading={submitting}
            disabled={invalid || overpay || submitting}
            onPress={() => void onSubmit(parsed, paidOn, note.trim() || undefined)}
          >
            Record
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.lg },
  hero: {
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.xs,
  },
  heroStatus: { marginTop: spacing.sm },
  customer: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  actions: { gap: spacing.md },
  action: { borderRadius: radius.full },
  actionContent: { height: 52 },
  actionRow: { flexDirection: "row", gap: spacing.md },
  paymentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
  },
  dialogTitle: { textAlign: "center" },
  dialogHint: { marginBottom: spacing.md },
  noteField: { marginTop: spacing.sm },
});

import React from "react";
import path from "path";
import { Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer";
import { BillWithCustomer } from "@/types";
import { decimalToNumber } from "@/lib/utils/format";

/**
 * The bill is printed in Hindi, so the built-in Helvetica is not usable — it has
 * no Devanagari glyphs (nor the ₹ sign). Noto Sans Devanagari covers Devanagari,
 * Latin and ₹, so names/addresses in either script and the amounts all render
 * from a single family.
 */
const FONT_DIR = path.join(process.cwd(), "public", "fonts");
Font.register({
  family: "NotoDev",
  fonts: [
    { src: path.join(FONT_DIR, "NotoSansDevanagari-Regular.ttf"), fontWeight: "normal" },
    { src: path.join(FONT_DIR, "NotoSansDevanagari-Bold.ttf"), fontWeight: "bold" },
  ],
});
// Devanagari words must not be hyphen-split mid-cluster.
Font.registerHyphenationCallback((word) => [word]);

/** Hindi month names, indexed 0-11 — shared with the multi-month statement. */
export const HINDI_MONTHS = [
  "जनवरी", "फरवरी", "मार्च", "अप्रैल", "मई", "जून",
  "जुलाई", "अगस्त", "सितंबर", "अक्टूबर", "नवंबर", "दिसंबर",
];

/** Amounts stay in English (Latin) digits with Indian grouping — e.g. ₹1,250.50. */
export function money(amount: number): string {
  return `₹${new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)}`;
}

/** Quantity in Latin digits with a Hindi unit. */
export function litres(n: number): string {
  return `${n.toFixed(1)} लीटर`;
}

/**
 * Dates are printed numerically ("16/07/2026"), NOT with Hindi month names.
 *
 * This is deliberate: react-pdf drops the final character of a string that
 * alternates scripts more than once — "दिनांक: 16 जुलाई 2026" renders as
 * "…जुलाई 202" (verified: it truncates even with a full page of free space, so
 * it is a shaping bug, not clipping). A numeric date keeps the string to a
 * single Devanagari→Latin switch, which renders correctly, and keeps the digits
 * in English as intended. Do not "improve" this back to month names without
 * re-testing that truncation.
 *
 * timeZone UTC because `@db.Date` values come back anchored at UTC midnight —
 * formatting them in the server's local zone could show the previous day.
 */
export function billDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

type InvoiceSettings = {
  farmName: string;
  farmAddress: string | null;
  farmPhone: string | null;
};

const c = {
  blue: "#2563eb",
  gray: "#888888",
  lightGray: "#e5e7eb",
  bgLight: "#f8fafc",
  bgRow: "#f9fafb",
  text: "#1a1a1a",
  sub: "#555555",
  green: "#15803d",
  red: "#b91c1c",
};

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 11, fontFamily: "NotoDev", color: c.text },

  // Header — dairy farm identity
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 2,
    borderBottomColor: c.blue,
    paddingBottom: 14,
    marginBottom: 18,
  },
  // flexShrink 0 + a floor width: without it the row squeezes the meta column and
  // clips the period/date text ("31 जुलाई 20…").
  headerLeft: { flex: 1, paddingRight: 12 },
  farmName: { fontSize: 19, fontWeight: "bold", color: c.blue },
  farmInfo: { fontSize: 9, color: c.gray, marginTop: 3 },
  metaBox: { alignItems: "flex-end", flexShrink: 0, minWidth: 190 },
  billTitle: { fontSize: 14, fontWeight: "bold", color: c.text },
  invoiceNo: { fontSize: 13, fontWeight: "bold", marginTop: 2 },
  metaLine: { fontSize: 9, color: c.gray, marginTop: 2 },

  section: { marginBottom: 16 },
  sectionTitle: {
    fontSize: 9,
    fontWeight: "bold",
    color: c.gray,
    marginBottom: 5,
  },

  // Bill to
  billTo: { backgroundColor: c.bgLight, padding: 10, borderRadius: 4 },
  billToRow: { flexDirection: "row", marginTop: 2 },
  billToLabel: { width: 90, fontSize: 10, color: c.gray },
  billToValue: { fontSize: 10, color: c.text, flex: 1 },
  billToName: { fontSize: 12, fontWeight: "bold" },

  // Summary (main content — no date-wise breakdown)
  summary: { borderWidth: 1, borderColor: c.lightGray, borderRadius: 6 },
  sumHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: c.blue,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  sumHeaderText: { color: "#ffffff", fontSize: 10, fontWeight: "bold" },
  sumRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: c.lightGray,
  },
  sumRowAlt: { backgroundColor: c.bgRow },
  sumLabel: { fontSize: 11 },
  sumValue: { fontSize: 11, fontWeight: "bold" },
  sumPaidLabel: { fontSize: 11, color: c.green },
  sumPaidValue: { fontSize: 11, fontWeight: "bold", color: c.green },

  dueRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fef2f2",
  },
  dueRowSettled: { backgroundColor: "#dcfce7" },
  dueText: { fontSize: 13, fontWeight: "bold", color: c.red },
  settledText: { fontSize: 13, fontWeight: "bold", color: c.green },

  paidStamp: {
    marginTop: 10,
    paddingVertical: 5,
    borderRadius: 4,
    backgroundColor: "#dcfce7",
    color: c.green,
    fontSize: 10,
    fontWeight: "bold",
    textAlign: "center",
  },

  // Payments received
  tableHeader: {
    flexDirection: "row",
    backgroundColor: c.bgLight,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: c.lightGray,
  },
  tableHeaderText: { fontSize: 9, fontWeight: "bold", color: c.sub },
  tableRow: {
    flexDirection: "row",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: c.lightGray,
  },
  tableCell: { fontSize: 10 },
  colPayDate: { width: "30%" },
  colPayNote: { width: "45%" },
  colPayAmount: { width: "25%", textAlign: "right", fontWeight: "bold", color: c.green },

  footer: {
    position: "absolute",
    bottom: 20,
    left: 32,
    right: 32,
    textAlign: "center",
    fontSize: 9,
    color: c.gray,
    borderTopWidth: 1,
    borderTopColor: c.lightGray,
    paddingTop: 8,
  },
});

/**
 * Shared with the multi-month statement so both documents read as the same
 * family (same header, bill-to block, totals framing and footer).
 */
export const billStyles = styles;

interface InvoiceDocumentProps {
  bill: BillWithCustomer;
  settings: InvoiceSettings;
}

/**
 * One bill as a single A4 page.
 *
 * Called as a plain function (not rendered as a <Component/>) so the element it
 * returns IS a <Page>: react-pdf requires <Document> children to be Pages, so
 * this can be reused for both a single bill and a batched print-all document.
 */
function billPage(bill: BillWithCustomer, settings: InvoiceSettings) {
  const payments = [...(bill.payments ?? [])].sort(
    (a, b) => new Date(a.paidOn).getTime() - new Date(b.paidOn).getTime()
  );
  const totalQty = decimalToNumber(bill.totalLiters);
  const billAmount = decimalToNumber(bill.totalAmount);
  const amountPaid = payments.reduce((s, p) => s + decimalToNumber(p.amountPaid), 0);
  const balanceDue = Math.max(0, billAmount - amountPaid);
  const settled = balanceDue <= 0.01;

  return (
      <Page key={bill.id} size="A4" style={styles.page}>
        {/* ── Dairy farm details + invoice meta ── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.farmName}>{settings.farmName}</Text>
            {settings.farmAddress ? (
              <Text style={styles.farmInfo}>{settings.farmAddress}</Text>
            ) : null}
            {settings.farmPhone ? (
              <Text style={styles.farmInfo}>संपर्क: {settings.farmPhone}</Text>
            ) : null}
          </View>
          <View style={styles.metaBox}>
            <Text style={styles.billTitle}>दूध बिल</Text>
            <Text style={styles.invoiceNo}>{bill.invoiceNumber}</Text>
            <Text style={styles.metaLine}>दिनांक: {billDate(new Date())}</Text>
            <Text style={styles.metaLine}>
              अवधि: {billDate(bill.periodStart)} – {billDate(bill.periodEnd)}
            </Text>
          </View>
        </View>

        {/* ── Bill to ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>बिल प्राप्तकर्ता</Text>
          <View style={styles.billTo}>
            <Text style={styles.billToName}>{bill.customer.name}</Text>
            {bill.customer.phoneNumber ? (
              <View style={styles.billToRow}>
                <Text style={styles.billToLabel}>संपर्क नंबर:</Text>
                <Text style={styles.billToValue}>{bill.customer.phoneNumber}</Text>
              </View>
            ) : null}
            {bill.customer.address ? (
              <View style={styles.billToRow}>
                <Text style={styles.billToLabel}>पता:</Text>
                <Text style={styles.billToValue}>{bill.customer.address}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* ── Bill summary (no date-wise breakdown) ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>बिल विवरण</Text>
          <View style={styles.summary}>
            <View style={styles.sumHeader}>
              <Text style={styles.sumHeaderText}>विवरण</Text>
              <Text style={styles.sumHeaderText}>राशि</Text>
            </View>

            <View style={styles.sumRow}>
              <Text style={styles.sumLabel}>कुल मात्रा</Text>
              <Text style={styles.sumValue}>{litres(totalQty)}</Text>
            </View>

            <View style={[styles.sumRow, styles.sumRowAlt]}>
              <Text style={styles.sumLabel}>दर (प्रति लीटर)</Text>
              <Text style={styles.sumValue}>{money(decimalToNumber(bill.pricePerLiter))}</Text>
            </View>

            <View style={styles.sumRow}>
              <Text style={styles.sumLabel}>कुल बिल राशि</Text>
              <Text style={styles.sumValue}>{money(billAmount)}</Text>
            </View>

            <View style={[styles.sumRow, styles.sumRowAlt]}>
              <Text style={styles.sumPaidLabel}>भुगतान प्राप्त</Text>
              <Text style={styles.sumPaidValue}>
                {amountPaid > 0.01 ? `- ${money(amountPaid)}` : money(0)}
              </Text>
            </View>

            <View style={[styles.dueRow, settled ? styles.dueRowSettled : {}]}>
              <Text style={settled ? styles.settledText : styles.dueText}>शेष राशि</Text>
              <Text style={settled ? styles.settledText : styles.dueText}>{money(balanceDue)}</Text>
            </View>
          </View>
          {settled ? (
            <Text style={styles.paidStamp}>पूर्ण भुगतान प्राप्त – धन्यवाद</Text>
          ) : null}
        </View>

        {/* ── Payments received against this bill ── */}
        {payments.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>प्राप्त भुगतान</Text>
            <View>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderText, styles.colPayDate]}>दिनांक</Text>
                <Text style={[styles.tableHeaderText, styles.colPayNote]}>विवरण</Text>
                <Text style={[styles.tableHeaderText, styles.colPayAmount]}>राशि</Text>
              </View>
              {payments.map((p) => (
                <View key={p.id} style={styles.tableRow}>
                  <Text style={[styles.tableCell, styles.colPayDate]}>{billDate(p.paidOn)}</Text>
                  <Text style={[styles.tableCell, styles.colPayNote]}>{p.note || "—"}</Text>
                  <Text style={[styles.tableCell, styles.colPayAmount]}>
                    {money(decimalToNumber(p.amountPaid))}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <Text style={styles.footer}>धन्यवाद! – {settings.farmName}</Text>
      </Page>
  );
}

/** A single bill. */
export function InvoiceDocument({ bill, settings }: InvoiceDocumentProps) {
  return <Document>{billPage(bill, settings)}</Document>;
}

/**
 * Every bill for a period in one document — one bill per page — so the whole
 * month can be printed or saved in a single file.
 */
export function BillsBatchDocument({
  bills,
  settings,
}: {
  bills: BillWithCustomer[];
  settings: InvoiceSettings;
}) {
  return <Document>{bills.map((bill) => billPage(bill, settings))}</Document>;
}

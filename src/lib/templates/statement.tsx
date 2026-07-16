import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { Statement } from "@/lib/services/statement.service";
import { billStyles, money, litres, billDate, HINDI_MONTHS } from "./invoice";

/**
 * A consolidated statement: one document covering several months, each shown as
 * its own summary line, with the overall total, total paid and total pending.
 *
 * Shares the bill's font registration and styles (imported from ./invoice) so a
 * statement and a single bill look like the same document family.
 */
const s = StyleSheet.create({
  monthHeader: {
    flexDirection: "row",
    backgroundColor: "#2563eb",
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  headText: { color: "#ffffff", fontSize: 9, fontWeight: "bold" },
  row: {
    flexDirection: "row",
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  rowAlt: { backgroundColor: "#f9fafb" },
  cell: { fontSize: 9 },
  cellBold: { fontSize: 9, fontWeight: "bold" },

  colMonth: { width: "26%" },
  colQty: { width: "16%", textAlign: "right" },
  colRate: { width: "16%", textAlign: "right" },
  colAmt: { width: "16%", textAlign: "right" },
  colPaid: { width: "13%", textAlign: "right" },
  colDue: { width: "13%", textAlign: "right" },

  invoiceNo: { fontSize: 7, color: "#888888", marginTop: 1 },

  totalsBox: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 6,
    alignSelf: "flex-end",
    width: 260,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  totalLabel: { fontSize: 10 },
  totalValue: { fontSize: 10, fontWeight: "bold" },
  paidLabel: { fontSize: 10, color: "#15803d" },
  paidValue: { fontSize: 10, fontWeight: "bold", color: "#15803d" },
  dueRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: "#fef2f2",
  },
  dueRowSettled: { backgroundColor: "#dcfce7" },
  dueText: { fontSize: 12, fontWeight: "bold", color: "#b91c1c" },
  settledText: { fontSize: 12, fontWeight: "bold", color: "#15803d" },

  notesBox: {
    marginTop: 14,
    backgroundColor: "#f8fafc",
    borderRadius: 4,
    padding: 10,
  },
  notesLabel: { fontSize: 8, fontWeight: "bold", color: "#888888", marginBottom: 3 },
  notesText: { fontSize: 9, color: "#555555" },
});

type StatementSettings = {
  farmName: string;
  farmAddress: string | null;
  farmPhone: string | null;
};

export function StatementDocument({
  statement,
  settings,
}: {
  statement: Statement;
  settings: StatementSettings;
}) {
  const { customer, months, totals, notes } = statement;
  const settled = totals.due <= 0.01;
  const periodLabel =
    months.length > 0
      ? `${billDate(months[0].periodStart)} – ${billDate(months[months.length - 1].periodEnd)}`
      : "—";

  return (
    <Document>
      <Page size="A4" style={billStyles.page}>
        {/* Farm + statement meta */}
        <View style={billStyles.header}>
          <View style={billStyles.headerLeft}>
            <Text style={billStyles.farmName}>{settings.farmName}</Text>
            {settings.farmAddress ? (
              <Text style={billStyles.farmInfo}>{settings.farmAddress}</Text>
            ) : null}
            {settings.farmPhone ? (
              <Text style={billStyles.farmInfo}>संपर्क: {settings.farmPhone}</Text>
            ) : null}
          </View>
          <View style={billStyles.metaBox}>
            <Text style={billStyles.billTitle}>दूध बिल विवरण</Text>
            <Text style={billStyles.metaLine}>दिनांक: {billDate(new Date())}</Text>
            <Text style={billStyles.metaLine}>अवधि: {periodLabel}</Text>
            <Text style={billStyles.metaLine}>
              कुल {months.length} माह
            </Text>
          </View>
        </View>

        {/* Bill to */}
        <View style={billStyles.section}>
          <Text style={billStyles.sectionTitle}>बिल प्राप्तकर्ता</Text>
          <View style={billStyles.billTo}>
            <Text style={billStyles.billToName}>{customer.name}</Text>
            {customer.phoneNumber ? (
              <View style={billStyles.billToRow}>
                <Text style={billStyles.billToLabel}>संपर्क नंबर:</Text>
                <Text style={billStyles.billToValue}>{customer.phoneNumber}</Text>
              </View>
            ) : null}
            {customer.address ? (
              <View style={billStyles.billToRow}>
                <Text style={billStyles.billToLabel}>पता:</Text>
                <Text style={billStyles.billToValue}>{customer.address}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Month-wise summary — one line per selected month */}
        <View style={billStyles.section}>
          <Text style={billStyles.sectionTitle}>माहवार विवरण</Text>
          <View style={billStyles.summary}>
            <View style={s.monthHeader}>
              <Text style={[s.headText, s.colMonth]}>माह</Text>
              <Text style={[s.headText, s.colQty]}>मात्रा</Text>
              <Text style={[s.headText, s.colRate]}>दर</Text>
              <Text style={[s.headText, s.colAmt]}>राशि</Text>
              <Text style={[s.headText, s.colPaid]}>भुगतान</Text>
              <Text style={[s.headText, s.colDue]}>शेष</Text>
            </View>

            {months.map((m, i) => (
              <View key={m.key} style={[s.row, i % 2 === 1 ? s.rowAlt : {}]}>
                <View style={s.colMonth}>
                  <Text style={s.cellBold}>
                    {HINDI_MONTHS[m.month - 1]} {m.year}
                  </Text>
                  <Text style={s.invoiceNo}>{m.invoiceNumber}</Text>
                </View>
                <Text style={[s.cell, s.colQty]}>{litres(m.liters)}</Text>
                <Text style={[s.cell, s.colRate]}>{money(m.pricePerLiter)}</Text>
                <Text style={[s.cellBold, s.colAmt]}>{money(m.amount)}</Text>
                <Text style={[s.cell, s.colPaid, { color: "#15803d" }]}>{money(m.paid)}</Text>
                <Text style={[s.cell, s.colDue, { color: m.due > 0.01 ? "#b91c1c" : "#15803d" }]}>
                  {money(m.due)}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Overall totals */}
        <View style={s.totalsBox}>
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>कुल मात्रा</Text>
            <Text style={s.totalValue}>{litres(totals.liters)}</Text>
          </View>
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>कुल बिल राशि</Text>
            <Text style={s.totalValue}>{money(totals.amount)}</Text>
          </View>
          <View style={s.totalRow}>
            <Text style={s.paidLabel}>कुल भुगतान प्राप्त</Text>
            <Text style={s.paidValue}>
              {totals.paid > 0.01 ? `- ${money(totals.paid)}` : money(0)}
            </Text>
          </View>
          <View style={[s.dueRow, settled ? s.dueRowSettled : {}]}>
            <Text style={settled ? s.settledText : s.dueText}>कुल शेष राशि</Text>
            <Text style={settled ? s.settledText : s.dueText}>{money(totals.due)}</Text>
          </View>
        </View>

        {settled ? (
          <Text style={billStyles.paidStamp}>पूर्ण भुगतान प्राप्त – धन्यवाद</Text>
        ) : null}

        {notes ? (
          <View style={s.notesBox}>
            <Text style={s.notesLabel}>टिप्पणी</Text>
            <Text style={s.notesText}>{notes}</Text>
          </View>
        ) : null}

        <Text style={billStyles.footer}>धन्यवाद! – {settings.farmName}</Text>
      </Page>
    </Document>
  );
}

import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { BillWithCustomer } from "@/types";
import { formatDate, formatCurrency, formatLiters, decimalToNumber } from "@/lib/utils/format";

// Types for entries and settings passed in
type Entry = {
  id: string;
  date: Date;
  morningLiters: unknown;
  eveningLiters: unknown;
  totalLiters: unknown;
};

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
};

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 11, fontFamily: "Helvetica", color: c.text },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 2,
    borderBottomColor: c.blue,
    paddingBottom: 14,
    marginBottom: 18,
  },
  farmName: { fontSize: 20, fontFamily: "Helvetica-Bold", color: c.blue },
  farmInfo: { fontSize: 9, color: c.gray, marginTop: 3 },
  invoiceMeta: { alignItems: "flex-end" },
  invoiceNo: { fontSize: 15, fontFamily: "Helvetica-Bold" },
  invoiceDate: { fontSize: 9, color: c.gray, marginTop: 2 },

  // Section
  section: { marginBottom: 16 },
  sectionTitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: c.gray,
    marginBottom: 5,
    letterSpacing: 0.5,
  },

  // Bill To
  billTo: { backgroundColor: c.bgLight, padding: 10, borderRadius: 4 },
  billToName: { fontFamily: "Helvetica-Bold", fontSize: 12 },
  billToInfo: { fontSize: 10, color: c.sub, marginTop: 2 },

  // Table
  tableHeader: {
    flexDirection: "row",
    backgroundColor: c.blue,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  tableHeaderText: { color: "white", fontSize: 10, fontFamily: "Helvetica-Bold" },
  tableRow: {
    flexDirection: "row",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: c.lightGray,
  },
  tableRowEven: { backgroundColor: c.bgRow },
  tableCell: { fontSize: 10 },
  colDate: { width: "30%" },
  colMorning: { width: "25%" },
  colEvening: { width: "25%" },
  colTotal: { width: "20%", fontFamily: "Helvetica-Bold" },

  // Summary
  summaryBox: {
    marginTop: 16,
    borderWidth: 2,
    borderColor: c.blue,
    borderRadius: 6,
    padding: 12,
    width: 220,
    alignSelf: "flex-end",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
    fontSize: 11,
  },
  summaryDivider: { borderTopWidth: 1, borderTopColor: c.lightGray, marginVertical: 4 },
  summaryTotalRow: { flexDirection: "row", justifyContent: "space-between", paddingTop: 4 },
  summaryTotalText: { fontSize: 13, fontFamily: "Helvetica-Bold", color: c.blue },

  // Footer
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

interface InvoiceDocumentProps {
  bill: BillWithCustomer;
  entries: Entry[];
  settings: InvoiceSettings;
}

export function InvoiceDocument({ bill, entries, settings }: InvoiceDocumentProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.farmName}>{settings.farmName}</Text>
            {settings.farmAddress ? (
              <Text style={styles.farmInfo}>{settings.farmAddress}</Text>
            ) : null}
            {settings.farmPhone ? (
              <Text style={styles.farmInfo}>Phone: {settings.farmPhone}</Text>
            ) : null}
          </View>
          <View style={styles.invoiceMeta}>
            <Text style={styles.invoiceNo}>{bill.invoiceNumber}</Text>
            <Text style={styles.invoiceDate}>Date: {formatDate(new Date())}</Text>
            <Text style={styles.invoiceDate}>
              Period: {formatDate(bill.periodStart)} - {formatDate(bill.periodEnd)}
            </Text>
          </View>
        </View>

        {/* Bill To */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>BILL TO</Text>
          <View style={styles.billTo}>
            <Text style={styles.billToName}>{bill.customer.name}</Text>
            <Text style={styles.billToInfo}>{bill.customer.phoneNumber}</Text>
            {bill.customer.address ? (
              <Text style={styles.billToInfo}>{bill.customer.address}</Text>
            ) : null}
          </View>
        </View>

        {/* Entries Table */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DATE-WISE BREAKDOWN</Text>
          <View>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, styles.colDate]}>Date</Text>
              <Text style={[styles.tableHeaderText, styles.colMorning]}>Morning</Text>
              <Text style={[styles.tableHeaderText, styles.colEvening]}>Evening</Text>
              <Text style={[styles.tableHeaderText, styles.colTotal]}>Total</Text>
            </View>
            {entries.length > 0 ? (
              entries.map((e, i) => {
                const morning = decimalToNumber(e.morningLiters);
                const evening = decimalToNumber(e.eveningLiters);
                const total = decimalToNumber(e.totalLiters);
                return (
                  <View
                    key={e.id}
                    style={[styles.tableRow, i % 2 === 1 ? styles.tableRowEven : {}]}
                  >
                    <Text style={[styles.tableCell, styles.colDate]}>{formatDate(e.date)}</Text>
                    <Text style={[styles.tableCell, styles.colMorning]}>
                      {morning > 0 ? formatLiters(morning) : "-"}
                    </Text>
                    <Text style={[styles.tableCell, styles.colEvening]}>
                      {evening > 0 ? formatLiters(evening) : "-"}
                    </Text>
                    <Text style={[styles.tableCell, styles.colTotal]}>{formatLiters(total)}</Text>
                  </View>
                );
              })
            ) : (
              <View style={styles.tableRow}>
                <Text style={{ fontSize: 10, color: c.gray, width: "100%", textAlign: "center" }}>
                  No entries found
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Summary Box */}
        <View style={styles.summaryBox}>
          <View style={styles.summaryRow}>
            <Text>Total Liters</Text>
            <Text>{formatLiters(decimalToNumber(bill.totalLiters))}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text>Price / Liter</Text>
            <Text>{formatCurrency(decimalToNumber(bill.pricePerLiter))}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryTotalRow}>
            <Text style={styles.summaryTotalText}>TOTAL AMOUNT</Text>
            <Text style={styles.summaryTotalText}>
              {formatCurrency(decimalToNumber(bill.totalAmount))}
            </Text>
          </View>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          Thank you for your business! - {settings.farmName}
        </Text>
      </Page>
    </Document>
  );
}

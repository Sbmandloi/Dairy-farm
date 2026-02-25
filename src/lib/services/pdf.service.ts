import React from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { BillWithCustomer } from "@/types";
import { getEntriesForPeriod } from "./daily-entry.service";
import { getSettings } from "./settings.service";
import { InvoiceDocument } from "@/lib/templates/invoice";

export async function generatePdfBuffer(bill: BillWithCustomer): Promise<Buffer> {
  const [entries, settings] = await Promise.all([
    getEntriesForPeriod(bill.customerId, bill.periodStart, bill.periodEnd),
    getSettings(),
  ]);

  // renderToBuffer expects ReactElement<DocumentProps>; cast needed because
  // React.createElement(FunctionComponent) returns FunctionComponentElement.
  const doc = React.createElement(InvoiceDocument, {
    bill,
    entries,
    settings: {
      farmName: settings.farmName,
      farmAddress: settings.farmAddress,
      farmPhone: settings.farmPhone,
    },
  }) as unknown as React.ReactElement<DocumentProps>;

  const uint8 = await renderToBuffer(doc);
  return Buffer.from(uint8);
}

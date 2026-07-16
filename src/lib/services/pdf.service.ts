import React from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { BillWithCustomer } from "@/types";
import { getSettings } from "./settings.service";
import { InvoiceDocument, BillsBatchDocument } from "@/lib/templates/invoice";
import { StatementDocument } from "@/lib/templates/statement";
import type { Statement } from "./statement.service";

/**
 * Render a bill to a PDF buffer (no filesystem — serverless-safe).
 *
 * The bill deliberately carries no date-wise breakdown, so per-day entries are
 * not fetched here: the totals stored on the bill are all the document needs.
 */
export async function generatePdfBuffer(bill: BillWithCustomer): Promise<Buffer> {
  const settings = await getSettings();

  // renderToBuffer expects ReactElement<DocumentProps>; cast needed because
  // React.createElement(FunctionComponent) returns FunctionComponentElement.
  const doc = React.createElement(InvoiceDocument, {
    bill,
    settings: {
      farmName: settings.farmName,
      farmAddress: settings.farmAddress,
      farmPhone: settings.farmPhone,
    },
  }) as unknown as React.ReactElement<DocumentProps>;

  const uint8 = await renderToBuffer(doc);
  return Buffer.from(uint8);
}

/**
 * Render a consolidated multi-month statement: one document with a summary line
 * per month plus overall total / paid / pending.
 */
export async function generateStatementPdfBuffer(statement: Statement): Promise<Buffer> {
  const settings = await getSettings();

  const doc = React.createElement(StatementDocument, {
    statement,
    settings: {
      farmName: settings.farmName,
      farmAddress: settings.farmAddress,
      farmPhone: settings.farmPhone,
    },
  }) as unknown as React.ReactElement<DocumentProps>;

  const uint8 = await renderToBuffer(doc);
  return Buffer.from(uint8);
}

/**
 * Render many bills into ONE PDF, a bill per page — for "print all", so a whole
 * month can be printed in a single job / saved as a single file.
 */
export async function generateBillsBatchPdfBuffer(
  bills: BillWithCustomer[]
): Promise<Buffer> {
  const settings = await getSettings();

  const doc = React.createElement(BillsBatchDocument, {
    bills,
    settings: {
      farmName: settings.farmName,
      farmAddress: settings.farmAddress,
      farmPhone: settings.farmPhone,
    },
  }) as unknown as React.ReactElement<DocumentProps>;

  const uint8 = await renderToBuffer(doc);
  return Buffer.from(uint8);
}

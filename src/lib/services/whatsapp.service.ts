import { getSettings } from "./settings.service";
import { getBillById } from "./billing.service";
import { buildCustomerStatement } from "./statement.service";
import { generatePdfBuffer, generateStatementPdfBuffer } from "./pdf.service";
import { HINDI_MONTHS } from "@/lib/templates/invoice";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/utils/encryption";
import { toGreenApiChatId } from "@/lib/utils/phone";
import { formatCurrency } from "@/lib/utils/format";
import { BillWithCustomer } from "@/types";

// Green API base URL: https://api.green-api.com/waInstance{idInstance}/{method}/{apiTokenInstance}
const GREEN_API_BASE = "https://api.green-api.com";

async function getGreenApiConfig() {
  const settings = await getSettings();
  // idInstance is stored in whatsappPhoneNumberId field
  // apiTokenInstance is stored in whatsappAccessToken field
  if (!settings.whatsappPhoneNumberId || !settings.whatsappAccessToken) {
    throw new Error("Green API is not configured. Please add Instance ID and API Token in Settings.");
  }
  let token = settings.whatsappAccessToken;
  try {
    token = decrypt(token);
  } catch {
    // token might not be encrypted in dev
  }
  return { idInstance: settings.whatsappPhoneNumberId, apiToken: token };
}

function greenApiUrl(idInstance: string, method: string, apiToken: string) {
  return `${GREEN_API_BASE}/waInstance${idInstance}/${method}/${apiToken}`;
}

async function sendPdfBuffer(
  idInstance: string,
  apiToken: string,
  chatId: string,
  pdfBuffer: Buffer,
  fileName: string,
  caption: string
): Promise<string> {
  const formData = new FormData();
  formData.append("chatId", chatId);
  formData.append("file", new Blob([new Uint8Array(pdfBuffer)], { type: "application/pdf" }), fileName);
  formData.append("fileName", fileName);
  formData.append("caption", caption);

  const res = await fetch(greenApiUrl(idInstance, "sendFileByUpload", apiToken), {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Green API error: ${JSON.stringify(err)}`);
  }

  const data = await res.json();
  return data.idMessage as string;
}

async function sendTextMessage(
  idInstance: string,
  apiToken: string,
  chatId: string,
  message: string
): Promise<string> {
  const res = await fetch(greenApiUrl(idInstance, "sendMessage", apiToken), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chatId, message }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Green API error: ${JSON.stringify(err)}`);
  }

  const data = await res.json();
  return data.idMessage as string;
}

/**
 * Send a customer a plain-text nudge about their outstanding dues. Unlike
 * sendBillViaWhatsApp this does NOT touch bill status — a reminder is a nudge,
 * not a re-delivery of the invoice.
 */
export async function sendPaymentReminder(customerId: string): Promise<string> {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: { bills: { include: { payments: true } } },
  });
  if (!customer) throw new Error("Customer not found");

  if (!customer.phoneNumber) {
    throw new Error(`${customer.name} has no phone number. Add one to send a reminder.`);
  }

  const pending = customer.bills.reduce((sum, b) => {
    const paid = b.payments.reduce((s, p) => s + parseFloat(String(p.amountPaid)), 0);
    return sum + (parseFloat(String(b.totalAmount)) - paid);
  }, 0);

  if (pending <= 0.01) {
    throw new Error(`${customer.name} has no outstanding dues.`);
  }

  const { idInstance, apiToken } = await getGreenApiConfig();
  const settings = await getSettings();

  // Reminder text is in Hindi (Devanagari), but the amount stays in English
  // (Latin) digits — e.g. "₹1,250.00" — so the number is universally readable.
  // Customer name and farm name are kept verbatim (usually already Latin).
  const amount = formatCurrency(pending);
  const message =
    `नमस्ते ${customer.name} जी,\n\n` +
    `यह एक विनम्र स्मरण है कि आपके दूध खाते पर ${amount} बकाया है।\n\n` +
    `कृपया अपनी सुविधानुसार भुगतान कर दें।\n\n` +
    `धन्यवाद,\n${settings.farmName}`;

  const msgId = await sendTextMessage(
    idInstance,
    apiToken,
    toGreenApiChatId(customer.phoneNumber),
    message
  );

  await prisma.customer.update({
    where: { id: customerId },
    data: { lastRemindedAt: new Date() },
  });

  return msgId;
}

/**
 * Send a consolidated multi-month statement as a single PDF.
 *
 * Unlike sendBillViaWhatsApp this does NOT mark the individual monthly bills as
 * SENT — a statement is a summary across months, and flipping several bills'
 * status from one message would misreport what was actually delivered for each
 * month. The caption is in Hindi with amounts in English digits, matching the
 * document.
 */
export async function sendStatementViaWhatsApp(
  customerId: string,
  monthKeys: string[],
  notes?: string | null
): Promise<string> {
  const statement = await buildCustomerStatement(customerId, monthKeys, notes);

  if (statement.months.length === 0) {
    throw new Error("No milk entries in the selected month(s) — nothing to send.");
  }
  if (!statement.customer.phoneNumber) {
    throw new Error(`${statement.customer.name} has no phone number.`);
  }

  const { idInstance, apiToken } = await getGreenApiConfig();
  const settings = await getSettings();
  const pdfBuffer = await generateStatementPdfBuffer(statement);

  const first = statement.months[0];
  const last = statement.months[statement.months.length - 1];
  const span =
    statement.months.length === 1
      ? `${HINDI_MONTHS[first.month - 1]} ${first.year}`
      : `${HINDI_MONTHS[first.month - 1]} ${first.year} – ${HINDI_MONTHS[last.month - 1]} ${last.year}`;

  const caption =
    `नमस्ते ${statement.customer.name} जी,\n\n` +
    `${span} का दूध बिल संलग्न है।\n\n` +
    `कुल मात्रा: ${statement.totals.liters.toFixed(1)} लीटर\n` +
    `कुल बिल राशि: ${formatCurrency(statement.totals.amount)}\n` +
    (statement.totals.paid > 0.01
      ? `भुगतान प्राप्त: ${formatCurrency(statement.totals.paid)}\n`
      : "") +
    (statement.totals.due > 0.01
      ? `शेष राशि: ${formatCurrency(statement.totals.due)}`
      : `शेष राशि: ${formatCurrency(0)} – पूर्ण भुगतान प्राप्त, धन्यवाद!`) +
    `\n\nधन्यवाद,\n${settings.farmName}`;

  const safeName = statement.customer.name.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase();
  const fileName = `bill-${safeName}-${monthKeys[0]}.pdf`;

  return sendPdfBuffer(
    idInstance,
    apiToken,
    toGreenApiChatId(statement.customer.phoneNumber),
    pdfBuffer,
    fileName,
    caption
  );
}

export async function sendBillViaWhatsApp(billId: string): Promise<string> {
  const bill = await getBillById(billId);
  if (!bill) throw new Error("Bill not found");

  // Phone number is optional on a customer, but WhatsApp delivery cannot work
  // without one — fail loudly rather than sending to a malformed chatId.
  if (!bill.customer.phoneNumber) {
    throw new Error(
      `${bill.customer.name} has no phone number. Add one to send bills via WhatsApp.`
    );
  }

  const { idInstance, apiToken } = await getGreenApiConfig();
  const settings = await getSettings();

  // Format phone number as Green API chatId (e.g. "919876543210@c.us")
  const chatId = toGreenApiChatId(bill.customer.phoneNumber);

  // Generate PDF buffer (no filesystem involved — serverless-safe)
  const pdfBuffer = await generatePdfBuffer(bill as BillWithCustomer);

  const month = bill.periodStart.toLocaleString("en-IN", { month: "long", year: "numeric" });

  // Quote the full picture, not just the gross total: a customer who has already
  // paid part of this bill should see that credited, and only owe the balance.
  const billAmount = parseFloat(String(bill.totalAmount));
  const paid = bill.payments.reduce((s, p) => s + parseFloat(String(p.amountPaid)), 0);
  const balance = Math.max(0, billAmount - paid);

  const caption =
    `Milk bill for ${month}\n` +
    `From: ${settings.farmName}\n` +
    `Invoice: ${bill.invoiceNumber}\n\n` +
    `Total Bill: Rs.${billAmount.toFixed(2)}\n` +
    (paid > 0.01 ? `Amount Paid: Rs.${paid.toFixed(2)}\n` : "") +
    (balance > 0.01
      ? `Balance Due: Rs.${balance.toFixed(2)}`
      : `Balance Due: Rs.0.00 - PAID IN FULL, thank you!`);

  const fileName = `${bill.invoiceNumber}.pdf`;
  const msgId = await sendPdfBuffer(idInstance, apiToken, chatId, pdfBuffer, fileName, caption);

  await prisma.bill.update({
    where: { id: billId },
    data: { status: "SENT", whatsappMsgId: msgId, sentAt: new Date() },
  });

  return msgId;
}

export async function sendAllBillsWhatsApp(periodStart: Date, periodEnd: Date) {
  const bills = await prisma.bill.findMany({
    where: {
      periodStart,
      periodEnd,
      status: { in: ["GENERATED", "PARTIALLY_PAID"] },
      // Only active, non-archived customers get the month's bulk send — matching
      // who bills are generated and printed for. Anyone without a phone number is
      // skipped here rather than failing the whole batch on them.
      customer: { isActive: true, deletedAt: null, phoneNumber: { not: null } },
    },
    include: { customer: true, payments: true },
    orderBy: { customer: { name: "asc" } },
  });

  // Sent one at a time so a single bad number can't fail the whole run — each
  // outcome is reported back with the customer's name.
  const results = [];
  for (const bill of bills) {
    try {
      const msgId = await sendBillViaWhatsApp(bill.id);
      results.push({
        billId: bill.id,
        customerName: bill.customer.name,
        success: true,
        msgId,
      });
    } catch (error) {
      results.push({
        billId: bill.id,
        customerName: bill.customer.name,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
  return results;
}

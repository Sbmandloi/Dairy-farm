import { getSettings } from "./settings.service";
import { getBillById } from "./billing.service";
import { generatePdfBuffer } from "./pdf.service";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/utils/encryption";
import { toGreenApiChatId } from "@/lib/utils/phone";
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

export async function sendBillViaWhatsApp(billId: string): Promise<string> {
  const bill = await getBillById(billId);
  if (!bill) throw new Error("Bill not found");

  const { idInstance, apiToken } = await getGreenApiConfig();
  const settings = await getSettings();

  // Format phone number as Green API chatId (e.g. "919876543210@c.us")
  const chatId = toGreenApiChatId(bill.customer.phoneNumber);

  // Generate PDF buffer (no filesystem involved — serverless-safe)
  const pdfBuffer = await generatePdfBuffer(bill as BillWithCustomer);

  const month = bill.periodStart.toLocaleString("en-IN", { month: "long", year: "numeric" });
  const totalAmount = parseFloat(String(bill.totalAmount)).toFixed(2);
  const caption = `Milk bill for ${month}\nFrom: ${settings.farmName}\nTotal: Rs.${totalAmount}\nInvoice: ${bill.invoiceNumber}`;

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
    where: { periodStart, periodEnd, status: { in: ["GENERATED", "PARTIALLY_PAID"] } },
    include: { customer: true, payments: true },
  });

  const results = [];
  for (const bill of bills) {
    try {
      const msgId = await sendBillViaWhatsApp(bill.id);
      results.push({ billId: bill.id, success: true, msgId });
    } catch (error) {
      results.push({
        billId: bill.id,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
  return results;
}

"use server";

import { revalidatePath } from "next/cache";
import { generateBillsSchema, markPaidSchema } from "@/lib/schemas/billing.schema";
import {
  generateBillsForPeriod,
  markBillPaid,
  createManualBill,
} from "@/lib/services/billing.service";
import { sendBillViaWhatsApp, sendAllBillsWhatsApp } from "@/lib/services/whatsapp.service";
import { ActionResult } from "@/types";

// Serializable bill summary (no Prisma Decimal / Date)
export interface SerializedBillSummary {
  id: string;
  customerId: string;
  invoiceNumber: string;
  totalLiters: number;
  pricePerLiter: number;
  totalAmount: number;
  status: string;
  periodStart: string;
  periodEnd: string;
}

export async function generateBillsAction(
  periodStart: string,
  periodEnd: string,
  customerId?: string
): Promise<ActionResult<SerializedBillSummary[]>> {
  try {
    const parsed = generateBillsSchema.safeParse({ periodStart, periodEnd, customerId });
    if (!parsed.success) {
      return { success: false, error: "Invalid period" };
    }

    const bills = await generateBillsForPeriod(
      new Date(parsed.data.periodStart),
      new Date(parsed.data.periodEnd),
      parsed.data.customerId
    );
    revalidatePath("/billing");

    // Serialize Decimal → number so it crosses the Server Action boundary cleanly
    return {
      success: true,
      data: bills.map((b) => ({
        id: b.id,
        customerId: b.customerId,
        invoiceNumber: b.invoiceNumber,
        totalLiters: parseFloat(String(b.totalLiters)),
        pricePerLiter: parseFloat(String(b.pricePerLiter)),
        totalAmount: parseFloat(String(b.totalAmount)),
        status: b.status,
        periodStart: b.periodStart.toISOString().split("T")[0],
        periodEnd: b.periodEnd.toISOString().split("T")[0],
      })),
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to generate bills" };
  }
}

export async function markBillPaidAction(
  billId: string,
  amountPaid: number,
  paidOn: string,
  note?: string
): Promise<ActionResult<void>> {
  try {
    const parsed = markPaidSchema.safeParse({ billId, amountPaid, paidOn, note });
    if (!parsed.success) {
      return { success: false, error: "Validation failed", fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
    }

    await markBillPaid(
      parsed.data.billId,
      parsed.data.amountPaid,
      new Date(parsed.data.paidOn),
      parsed.data.note
    );
    revalidatePath("/billing");
    revalidatePath(`/billing/${billId}`);
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to mark as paid" };
  }
}

export async function sendBillWhatsAppAction(billId: string): Promise<ActionResult<void>> {
  try {
    await sendBillViaWhatsApp(billId);
    revalidatePath("/billing");
    revalidatePath(`/billing/${billId}`);
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to send WhatsApp" };
  }
}

export async function createManualBillAction(data: {
  customerId: string;
  periodStart: string;
  periodEnd: string;
  totalLiters: number;
  pricePerLiter: number;
  notes?: string;
}): Promise<ActionResult<SerializedBillSummary & { customerName: string; customerPhone: string; customerAddress: string | null }>> {
  try {
    if (!data.customerId || !data.periodStart || !data.periodEnd || data.totalLiters <= 0 || data.pricePerLiter <= 0) {
      return { success: false, error: "Please fill all required fields with valid values" };
    }

    const bill = await createManualBill({
      customerId: data.customerId,
      periodStart: new Date(data.periodStart),
      periodEnd: new Date(data.periodEnd),
      totalLiters: data.totalLiters,
      pricePerLiter: data.pricePerLiter,
      notes: data.notes,
    });

    revalidatePath("/billing");
    revalidatePath("/quick-bill");

    return {
      success: true,
      data: {
        id: bill.id,
        customerId: bill.customerId,
        invoiceNumber: bill.invoiceNumber,
        totalLiters: parseFloat(String(bill.totalLiters)),
        pricePerLiter: parseFloat(String(bill.pricePerLiter)),
        totalAmount: parseFloat(String(bill.totalAmount)),
        status: bill.status,
        periodStart: bill.periodStart.toISOString().split("T")[0],
        periodEnd: bill.periodEnd.toISOString().split("T")[0],
        customerName: bill.customer.name,
        customerPhone: bill.customer.phoneNumber,
        customerAddress: bill.customer.address,
      },
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to create bill" };
  }
}

export async function sendAllBillsWhatsAppAction(
  periodStart: string,
  periodEnd: string
): Promise<ActionResult<{ billId: string; success: boolean; msgId?: string; error?: string }[]>> {
  try {
    const results = await sendAllBillsWhatsApp(new Date(periodStart), new Date(periodEnd));
    revalidatePath("/billing");
    return { success: true, data: results };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to send bills" };
  }
}

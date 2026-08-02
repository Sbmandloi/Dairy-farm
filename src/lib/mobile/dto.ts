import type { Bill, Customer, DailyMilkEntry, Payment, Settings } from "@prisma/client";
import { decimalToNumber } from "@/lib/utils/format";

/**
 * Wire shapes for the mobile API.
 *
 * Prisma hands back `Decimal` and `Date` instances, neither of which survives
 * JSON intact in a way a client can trust — `Decimal` stringifies, and a `Date`
 * would arrive as a UTC instant that the phone would then render in device
 * local time. The web app already solves this at every Server Component
 * boundary by hand-serializing; these mappers are the same conversion applied
 * once, in one place.
 *
 * The rule, matching the web app's date handling exactly:
 *   - `@db.Date` columns (calendar days) → "YYYY-MM-DD", never an instant.
 *     Sending an instant is what produces the classic "bill shows a day early"
 *     bug once a device west of UTC formats it locally.
 *   - real timestamps (createdAt, sentAt) → full ISO string.
 *   - `Decimal` → number.
 */

/** A Postgres `@db.Date` value as the calendar day it represents. */
export function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function dateOnlyOrNull(value: Date | null): string | null {
  return value ? dateOnly(value) : null;
}

export function isoOrNull(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

export interface CustomerDTO {
  id: string;
  name: string;
  phoneNumber: string | null;
  address: string | null;
  pricePerLiter: number | null;
  isActive: boolean;
  startDate: string;
  lastRemindedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
}

export function toCustomerDTO(c: Customer): CustomerDTO {
  return {
    id: c.id,
    name: c.name,
    phoneNumber: c.phoneNumber,
    address: c.address,
    pricePerLiter: c.pricePerLiter === null ? null : decimalToNumber(c.pricePerLiter),
    isActive: c.isActive,
    startDate: dateOnly(c.startDate),
    lastRemindedAt: isoOrNull(c.lastRemindedAt),
    deletedAt: isoOrNull(c.deletedAt),
    createdAt: c.createdAt.toISOString(),
  };
}

export interface DailyEntryDTO {
  id: string;
  customerId: string;
  date: string;
  morningLiters: number | null;
  eveningLiters: number | null;
  totalLiters: number;
  notes: string | null;
}

export function toDailyEntryDTO(e: DailyMilkEntry): DailyEntryDTO {
  return {
    id: e.id,
    customerId: e.customerId,
    date: dateOnly(e.date),
    morningLiters: e.morningLiters === null ? null : decimalToNumber(e.morningLiters),
    eveningLiters: e.eveningLiters === null ? null : decimalToNumber(e.eveningLiters),
    totalLiters: decimalToNumber(e.totalLiters),
    notes: e.notes,
  };
}

export interface PaymentDTO {
  id: string;
  billId: string;
  amountPaid: number;
  paidOn: string;
  note: string | null;
  createdAt: string;
}

export function toPaymentDTO(p: Payment): PaymentDTO {
  return {
    id: p.id,
    billId: p.billId,
    amountPaid: decimalToNumber(p.amountPaid),
    paidOn: dateOnly(p.paidOn),
    note: p.note,
    createdAt: p.createdAt.toISOString(),
  };
}

export interface BillDTO {
  id: string;
  customerId: string;
  invoiceNumber: string;
  periodStart: string;
  periodEnd: string;
  totalLiters: number;
  pricePerLiter: number;
  totalAmount: number;
  status: string;
  sentAt: string | null;
  createdAt: string;
  /** Sum of every payment against this bill — the app never has to add these up. */
  paid: number;
  /** What is still owed. Clamped at zero so rounding noise never shows as a credit. */
  due: number;
}

type BillWithPayments = Bill & { payments: Payment[] };

export function toBillDTO(b: BillWithPayments): BillDTO {
  const totalAmount = decimalToNumber(b.totalAmount);
  const paid = b.payments.reduce((s, p) => s + decimalToNumber(p.amountPaid), 0);
  return {
    id: b.id,
    customerId: b.customerId,
    invoiceNumber: b.invoiceNumber,
    periodStart: dateOnly(b.periodStart),
    periodEnd: dateOnly(b.periodEnd),
    totalLiters: decimalToNumber(b.totalLiters),
    pricePerLiter: decimalToNumber(b.pricePerLiter),
    totalAmount,
    status: b.status,
    sentAt: isoOrNull(b.sentAt),
    createdAt: b.createdAt.toISOString(),
    paid,
    due: Math.max(0, totalAmount - paid),
  };
}

export interface SettingsDTO {
  farmName: string;
  farmAddress: string | null;
  farmPhone: string | null;
  globalPricePerLiter: number;
  billingCycleType: string;
  entryMode: string;
  whatsappBusinessAcctId: string | null;
  whatsappPhoneNumberId: string | null;
  whatsappTemplateName: string | null;
  /** Whether Green API can actually send. The token itself is never sent to a device. */
  whatsappConfigured: boolean;
  lastBackupAt: string | null;
}

export function toSettingsDTO(s: Settings): SettingsDTO {
  return {
    farmName: s.farmName,
    farmAddress: s.farmAddress,
    farmPhone: s.farmPhone,
    globalPricePerLiter: decimalToNumber(s.globalPricePerLiter),
    billingCycleType: s.billingCycleType,
    entryMode: s.entryMode,
    whatsappBusinessAcctId: s.whatsappBusinessAcctId,
    whatsappPhoneNumberId: s.whatsappPhoneNumberId,
    whatsappTemplateName: s.whatsappTemplateName,
    whatsappConfigured: !!(s.whatsappPhoneNumberId && s.whatsappAccessToken),
    lastBackupAt: isoOrNull(s.lastBackupAt),
  };
}

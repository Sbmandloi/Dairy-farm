import { api } from "./client";
import type {
  AppUser,
  Bill,
  BillDetail,
  BillingData,
  CollectionResult,
  Customer,
  CustomerManagerData,
  CustomerPatch,
  CustomerWithStats,
  DailyEntryData,
  DashboardData,
  MonthlyEntryData,
  PaymentHistory,
  ReportsData,
  SendAllResult,
  Settings,
  StatementPreview,
} from "./types";

/**
 * Every call the app can make, in one typed module.
 *
 * Screens never build URLs. Keeping the paths here means the API surface can be
 * read in one place and compared against the server's route tree, and a change
 * to an endpoint is a change to exactly one line.
 */

// ── auth ────────────────────────────────────────────────────────────────────
// Login and refresh live in the auth context, which owns the token lifecycle.

// ── dashboard ───────────────────────────────────────────────────────────────
export const getDashboard = () => api.get<DashboardData>("/api/mobile/dashboard");

// ── customers ───────────────────────────────────────────────────────────────
export interface CustomerFilter {
  search?: string;
  active?: boolean;
  archived?: boolean;
}

export function getCustomers(filter: CustomerFilter = {}) {
  const params = new URLSearchParams();
  if (filter.search) params.set("search", filter.search);
  if (filter.active !== undefined) params.set("active", String(filter.active));
  if (filter.archived) params.set("archived", "1");
  const query = params.toString();
  return api.get<CustomerWithStats[]>(`/api/mobile/customers${query ? `?${query}` : ""}`);
}

export interface CustomerInput {
  name: string;
  phoneNumber: string | null;
  address?: string;
  pricePerLiter?: string | number | null;
  startDate: string;
}

export const createCustomer = (input: CustomerInput) =>
  api.post<Customer>("/api/mobile/customers", input);

export const updateCustomer = (id: string, input: Partial<CustomerInput>) =>
  api.patch<Customer>(`/api/mobile/customers/${id}`, input);

export const getCustomer = (id: string) =>
  api.get<Customer & { bills: Bill[]; dailyEntries: DailyEntryData["rows"][number]["entry"][] }>(
    `/api/mobile/customers/${id}`
  );

/** Archive — a soft delete. The customer's history is retained and restorable. */
export const archiveCustomer = (id: string) =>
  api.delete<{ archived: true }>(`/api/mobile/customers/${id}`);

export const restoreCustomer = (id: string) =>
  api.post<Customer>(`/api/mobile/customers/${id}/actions`, { action: "restore" });

export const toggleCustomerStatus = (id: string) =>
  api.post<Customer>(`/api/mobile/customers/${id}/actions`, { action: "toggle-status" });

export const sendReminder = (id: string) =>
  api.slow<{ messageId: string }>(`/api/mobile/customers/${id}/actions`, { action: "remind" });

export const getPaymentHistory = (id: string) =>
  api.get<PaymentHistory>(`/api/mobile/customers/${id}/actions`);

// ── customer manager ────────────────────────────────────────────────────────
export const getCustomerManager = () =>
  api.get<CustomerManagerData>("/api/mobile/customer-manager");

export const saveCustomerPatches = (patches: CustomerPatch[]) =>
  api.patch<{ updated: number }>("/api/mobile/customer-manager", patches);

// ── daily entry ─────────────────────────────────────────────────────────────
export const getDailyEntry = (date: string) =>
  api.get<DailyEntryData>(`/api/mobile/daily-entry?date=${date}`);

export const getPreviousDay = (date: string) =>
  api.get<
    { customerId: string; morningLiters: number | null; eveningLiters: number | null; totalLiters: number }[]
  >(`/api/mobile/daily-entry?date=${date}&copyPrevious=1`);

export interface DailyEntryItem {
  customerId: string;
  morningLiters?: number | null;
  eveningLiters?: number | null;
  totalLiters: number;
  notes?: string | null;
}

export const saveDailyEntries = (date: string, entries: DailyEntryItem[]) =>
  api.post<{ saved: number }>("/api/mobile/daily-entry", { date, entries });

// ── monthly entry ───────────────────────────────────────────────────────────
export const getMonthlyEntry = (year: number, month: number) =>
  api.get<MonthlyEntryData>(`/api/mobile/monthly-entry?year=${year}&month=${month}`);

export interface MonthlyChange {
  date: string;
  customerId: string;
  totalLiters: number;
  morningLiters?: number | null;
  eveningLiters?: number | null;
}

export const saveMonthlyEntries = (changes: MonthlyChange[]) =>
  api.slow<{ saved: number }>("/api/mobile/monthly-entry", { changes });

// ── billing ─────────────────────────────────────────────────────────────────
export const getBilling = (year: number, month: number) =>
  api.get<BillingData>(`/api/mobile/billing?year=${year}&month=${month}`);

export const generateBills = (periodStart: string, periodEnd: string, customerId?: string) =>
  api.slow<Bill[]>("/api/mobile/billing", { periodStart, periodEnd, customerId });

export const getBill = (id: string) => api.get<BillDetail>(`/api/mobile/billing/${id}`);

export const markBillPaid = (
  id: string,
  input: { amountPaid: number; paidOn: string; note?: string }
) => api.post<{ marked: true }>(`/api/mobile/billing/${id}`, { action: "mark-paid", ...input });

export const sendBillWhatsApp = (id: string) =>
  api.slow<{ messageId: string }>(`/api/mobile/billing/${id}`, { action: "send-whatsapp" });

export const sendAllBills = (periodStart: string, periodEnd: string) =>
  api.slow<SendAllResult>("/api/mobile/billing/send-all", { periodStart, periodEnd });

// ── payments ────────────────────────────────────────────────────────────────
export interface CollectionInput {
  customerId: string;
  amount: number;
  paidOn: string;
  note?: string;
}

export const recordCollection = (input: CollectionInput) =>
  api.post<CollectionResult>("/api/mobile/payments", input);

export const updateCollection = (
  paymentId: string,
  input: { amount: number; paidOn: string; note?: string }
) => api.patch<{ updated: true }>(`/api/mobile/payments/${paymentId}`, input);

export const deleteCollection = (paymentId: string) =>
  api.delete<{ deleted: true }>(`/api/mobile/payments/${paymentId}`);

// ── statement (quick bill) ──────────────────────────────────────────────────
export const previewStatement = (customerId: string, months: string[]) =>
  api.slow<StatementPreview>("/api/mobile/statement", {
    action: "preview",
    customerId,
    months,
  });

export const sendStatement = (customerId: string, months: string[], notes?: string | null) =>
  api.slow<{ messageId: string }>("/api/mobile/statement", {
    action: "send",
    customerId,
    months,
    notes,
  });

// ── reports ─────────────────────────────────────────────────────────────────
export const getReports = () => api.get<ReportsData>("/api/mobile/reports");

// ── settings and users ──────────────────────────────────────────────────────
export const getSettings = () => api.get<Settings>("/api/mobile/settings");

export interface SettingsInput {
  farmName: string;
  farmAddress?: string;
  farmPhone?: string;
  globalPricePerLiter: string;
  billingCycleType: "MONTHLY";
  entryMode: "SPLIT" | "SINGLE";
  whatsappBusinessAcctId?: string;
  whatsappPhoneNumberId?: string;
  whatsappAccessToken?: string;
  whatsappTemplateName?: string;
}

export const updateSettings = (input: SettingsInput) =>
  api.put<Settings>("/api/mobile/settings", input);

export const getUsers = () => api.get<AppUser[]>("/api/mobile/users");

export const createUser = (input: { name: string; email: string; password: string }) =>
  api.post<AppUser>("/api/mobile/users", input);

export const deleteUser = (id: string) =>
  api.delete<{ deleted: true }>(`/api/mobile/users/${id}`);

// ── file downloads ──────────────────────────────────────────────────────────
// These return bytes, not the JSON envelope, so they go through the downloader
// in src/utils/download.ts rather than the JSON client.

export const billPdfPath = (id: string) => `/api/mobile/billing/${id}/pdf`;

export const monthPdfPath = (year: number, month: number) =>
  `/api/mobile/billing/print-all?year=${year}&month=${month}`;

export const statementPdfPath = (customerId: string, months: string[], notes?: string) =>
  `/api/mobile/statement/pdf?customerId=${customerId}&months=${months.join(",")}` +
  (notes ? `&notes=${encodeURIComponent(notes)}` : "");

export const exportPath = (
  kind: "customers" | "backup-csv" | "backup-json",
  params: Record<string, string> = {}
) => {
  const search = new URLSearchParams({ kind, ...params });
  return `/api/mobile/exports?${search.toString()}`;
};

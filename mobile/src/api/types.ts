/**
 * Wire types for /api/mobile/*.
 *
 * These mirror the DTOs the server builds in src/lib/mobile/dto.ts. They are
 * declared rather than imported because the two projects have separate
 * toolchains — but they are the same shapes, and the contract is exercised by
 * the API test suite in the parent project.
 *
 * Note what the types encode about dates: a field typed as a calendar day is
 * always "YYYY-MM-DD" and must never be fed to `new Date()` for display, or a
 * device west of UTC renders the day before. See src/utils/format.ts.
 */

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

export type BillStatus = "GENERATED" | "SENT" | "PAID" | "PARTIALLY_PAID";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: AuthUser;
}

export interface Customer {
  id: string;
  name: string;
  phoneNumber: string | null;
  address: string | null;
  pricePerLiter: number | null;
  isActive: boolean;
  /** Calendar day. */
  startDate: string;
  lastRemindedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
}

export interface CustomerStats {
  totalLiters: number;
  deliveryDays: number;
  totalBilled: number;
  totalPaid: number;
  balance: number;
}

export type CustomerWithStats = Customer & { stats: CustomerStats };

export interface DailyEntry {
  id: string;
  customerId: string;
  /** Calendar day. */
  date: string;
  morningLiters: number | null;
  eveningLiters: number | null;
  totalLiters: number;
  notes: string | null;
}

export interface Bill {
  id: string;
  customerId: string;
  invoiceNumber: string;
  /** Calendar day. */
  periodStart: string;
  /** Calendar day. */
  periodEnd: string;
  totalLiters: number;
  pricePerLiter: number;
  totalAmount: number;
  status: BillStatus;
  sentAt: string | null;
  createdAt: string;
  paid: number;
  due: number;
}

export interface Payment {
  id: string;
  billId: string;
  amountPaid: number;
  /** Calendar day. */
  paidOn: string;
  note: string | null;
  createdAt: string;
}

export interface DashboardStats {
  todayLiters: number;
  todayRevenue: number;
  monthLiters: number;
  monthRevenue: number;
  activeCustomers: number;
  pendingBills: number;
  pendingAmount: number;
}

export interface DashboardData {
  /** Calendar day, in the dairy's timezone — not the device's. */
  today: string;
  stats: DashboardStats;
  todayList: { customer: Customer; entry: DailyEntry | null }[];
  pendingBills: (Bill & { customer: Customer })[];
}

export type PaymentStanding = "NO_BILLS" | "PAID" | "PARTIAL" | "UNPAID";

export interface ManagedCustomer {
  id: string;
  name: string;
  phoneNumber: string | null;
  address: string | null;
  pricePerLiter: number | null;
  isActive: boolean;
  startDate: string;
  lastRemindedAt: string | null;
  totalLiters: number;
  totalBilled: number;
  totalPaid: number;
  pendingAmount: number;
  unpaidBills: number;
  paymentStanding: PaymentStanding;
  daysOverdue: number | null;
  lastPaymentOn: string | null;
  paymentsCount: number;
}

export interface CollectionEntry {
  id: string;
  amount: number;
  paidOn: string;
  note: string | null;
  createdAt: string;
  bill: {
    id: string;
    invoiceNumber: string;
    periodStart: string;
    periodEnd: string;
    totalAmount: number;
    stillDue: number;
  };
}

export interface CustomerManagerData {
  customers: ManagedCustomer[];
  collections: Record<string, CollectionEntry[]>;
  globalPricePerLiter: number;
}

export type EntryMode = "SPLIT" | "SINGLE";

export interface DailyEntryData {
  date: string;
  entryMode: EntryMode;
  globalPricePerLiter: number;
  summary: { totalLiters: number; estimatedRevenue: number; customerCount: number };
  rows: { customer: Customer; entry: DailyEntry | null }[];
}

export interface MonthlyEntryData {
  year: number;
  month: number;
  daysInMonth: number;
  entryMode: EntryMode;
  customers: { id: string; name: string; phoneNumber: string | null }[];
  entries: {
    id: string;
    customerId: string;
    date: string;
    morningLiters: number | null;
    eveningLiters: number | null;
    totalLiters: number;
  }[];
}

export interface BillingData {
  year: number;
  month: number;
  periodStart: string;
  periodEnd: string;
  summary: {
    totalLiters: number;
    totalAmount: number;
    totalPaid: number;
    outstanding: number;
    billCount: number;
    customerCount: number;
    withoutBill: number;
    sendableCount: number;
  };
  rows: { customer: Customer; bill: Bill | null }[];
}

export type BillDetail = Bill & { customer: Customer; payments: Payment[] };

export interface CollectionResult {
  amount: number;
  allocations: { invoiceNumber: string; amount: number }[];
  remainingPending: number;
}

export interface PaymentHistory {
  payments: {
    id: string;
    amountPaid: number;
    paidOn: string;
    note: string | null;
    bill: {
      id: string;
      invoiceNumber: string;
      status: BillStatus;
      periodStart: string;
      periodEnd: string;
      totalAmount: number;
      stillDue: number;
    };
  }[];
  totals: {
    totalBilled: number;
    totalPaid: number;
    totalPending: number;
    unpaidBills: number;
  };
}

export interface StatementPreview {
  months: { key: string; liters: number; pricePerLiter: number; amount: number; paid: number }[];
  emptyMonths: string[];
  totals: { liters: number; amount: number; paid: number; due: number };
}

export interface ReportsData {
  allTime: {
    totalBills: number;
    totalLiters: number;
    totalBilled: number;
    totalCollected: number;
    outstanding: number;
  };
  currentMonth: string;
  monthlySummary: {
    periodStart: string;
    year: number;
    month: number;
    bills: number;
    liters: number;
    amount: number;
  }[];
  topCustomers: { customerId: string; name: string; liters: number }[];
  recentPayments: {
    id: string;
    billId: string;
    customerName: string;
    invoiceNumber: string;
    amount: number;
    paidOn: string;
  }[];
  lastBackupAt: string | null;
}

export interface Settings {
  farmName: string;
  farmAddress: string | null;
  farmPhone: string | null;
  globalPricePerLiter: number;
  billingCycleType: string;
  entryMode: EntryMode;
  whatsappBusinessAcctId: string | null;
  whatsappPhoneNumberId: string | null;
  whatsappTemplateName: string | null;
  whatsappConfigured: boolean;
  lastBackupAt: string | null;
}

export interface AppUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  isCurrentUser: boolean;
}

export interface SendAllResult {
  results: {
    billId: string;
    customerName: string;
    success: boolean;
    msgId?: string;
    error?: string;
  }[];
  sent: number;
  failed: number;
}

/** A staged edit from the customer manager; omitted fields are left alone. */
export interface CustomerPatch {
  id: string;
  name?: string;
  phoneNumber?: string | null;
  address?: string;
  pricePerLiter?: number | string | null;
  isActive?: boolean;
}

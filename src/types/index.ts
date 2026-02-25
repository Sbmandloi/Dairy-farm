import { Customer, Bill, DailyMilkEntry, Payment, Settings, BillStatus } from "@prisma/client";

export type { Customer, Bill, DailyMilkEntry, Payment, Settings, BillStatus };

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

export type CustomerWithBills = Customer & {
  bills: Bill[];
  dailyEntries: DailyMilkEntry[];
};

export type BillWithCustomer = Bill & {
  customer: Customer;
  payments: Payment[];
};

export type DailyEntryInput = {
  customerId: string;
  morningLiters?: number;
  eveningLiters?: number;
  totalLiters: number;
  notes?: string;
};

export type BillingPeriod = {
  start: Date;
  end: Date;
  label: string;
};

export type DashboardStats = {
  todayLiters: number;
  todayRevenue: number;
  monthLiters: number;
  monthRevenue: number;
  activeCustomers: number;
  pendingBills: number;
  pendingAmount: number;
};

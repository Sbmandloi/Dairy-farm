export const APP_NAME = "Dairy Billing";

export const BILL_STATUS_LABELS: Record<string, string> = {
  GENERATED: "Generated",
  SENT: "Sent",
  PAID: "Paid",
  PARTIALLY_PAID: "Partially Paid",
};

export const BILL_STATUS_COLORS: Record<string, string> = {
  GENERATED: "bg-blue-100 text-blue-800",
  SENT: "bg-yellow-100 text-yellow-800",
  PAID: "bg-green-100 text-green-800",
  PARTIALLY_PAID: "bg-orange-100 text-orange-800",
};

export const ENTRY_MODES = {
  SPLIT: "SPLIT",
  SINGLE: "SINGLE",
} as const;

export const QUICK_ADD_AMOUNTS = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5];

export const ITEMS_PER_PAGE = 20;

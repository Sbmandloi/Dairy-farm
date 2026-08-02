import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as endpoints from "@/api/endpoints";
import {
  invalidateCustomers,
  invalidateEntries,
  invalidateMoney,
  keys,
  queryClient,
} from "@/api/query-client";
import type { CustomerPatch } from "@/api/types";

/**
 * Data hooks.
 *
 * One hook per thing a screen needs, so components never touch the API module
 * directly and every mutation invalidates the same set of caches its Server
 * Action counterpart revalidates on the web. Keeping that mapping in one file
 * is what stops the phone showing a stale balance after a payment.
 */

// ── dashboard ───────────────────────────────────────────────────────────────
export function useDashboard() {
  return useQuery({
    queryKey: keys.dashboard,
    queryFn: endpoints.getDashboard,
  });
}

// ── customers ───────────────────────────────────────────────────────────────
export function useCustomers(filter: endpoints.CustomerFilter = {}) {
  return useQuery({
    queryKey: keys.customerList(filter),
    queryFn: () => endpoints.getCustomers(filter),
  });
}

export function useCustomer(id: string) {
  return useQuery({
    queryKey: keys.customer(id),
    queryFn: () => endpoints.getCustomer(id),
    enabled: Boolean(id),
  });
}

export function useCustomerPayments(id: string) {
  return useQuery({
    queryKey: keys.customerPayments(id),
    queryFn: () => endpoints.getPaymentHistory(id),
    enabled: Boolean(id),
  });
}

export function useCreateCustomer() {
  return useMutation({
    mutationFn: endpoints.createCustomer,
    onSuccess: () => invalidateCustomers(),
  });
}

export function useUpdateCustomer(id: string) {
  return useMutation({
    mutationFn: (input: Partial<endpoints.CustomerInput>) => endpoints.updateCustomer(id, input),
    onSuccess: () => invalidateCustomers(id),
  });
}

export function useArchiveCustomer() {
  return useMutation({
    mutationFn: endpoints.archiveCustomer,
    onSuccess: (_data, id) => invalidateCustomers(id),
  });
}

export function useRestoreCustomer() {
  return useMutation({
    mutationFn: endpoints.restoreCustomer,
    onSuccess: (_data, id) => invalidateCustomers(id),
  });
}

export function useToggleCustomerStatus() {
  return useMutation({
    mutationFn: endpoints.toggleCustomerStatus,
    onSuccess: (_data, id) => invalidateCustomers(id),
  });
}

export function useSendReminder() {
  return useMutation({
    mutationFn: endpoints.sendReminder,
    // A reminder updates lastRemindedAt, which the manager screen displays.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.customerManager }),
  });
}

// ── customer manager ────────────────────────────────────────────────────────
export function useCustomerManager() {
  return useQuery({
    queryKey: keys.customerManager,
    queryFn: endpoints.getCustomerManager,
  });
}

export function useSaveCustomerPatches() {
  return useMutation({
    mutationFn: (patches: CustomerPatch[]) => endpoints.saveCustomerPatches(patches),
    onSuccess: () => invalidateCustomers(),
  });
}

// ── daily entry ─────────────────────────────────────────────────────────────
export function useDailyEntry(date: string) {
  return useQuery({
    queryKey: keys.dailyEntry(date),
    queryFn: () => endpoints.getDailyEntry(date),
  });
}

export function useSaveDailyEntries() {
  return useMutation({
    mutationFn: ({ date, entries }: { date: string; entries: endpoints.DailyEntryItem[] }) =>
      endpoints.saveDailyEntries(date, entries),
    onSuccess: () => invalidateEntries(),
  });
}

// ── monthly entry ───────────────────────────────────────────────────────────
export function useMonthlyEntry(year: number, month: number) {
  return useQuery({
    queryKey: keys.monthlyEntry(year, month),
    queryFn: () => endpoints.getMonthlyEntry(year, month),
  });
}

export function useSaveMonthlyEntries() {
  return useMutation({
    mutationFn: (changes: endpoints.MonthlyChange[]) => endpoints.saveMonthlyEntries(changes),
    onSuccess: () => invalidateEntries(),
  });
}

// ── billing ─────────────────────────────────────────────────────────────────
export function useBilling(year: number, month: number) {
  return useQuery({
    queryKey: keys.billing(year, month),
    queryFn: () => endpoints.getBilling(year, month),
  });
}

export function useBill(id: string) {
  return useQuery({
    queryKey: keys.bill(id),
    queryFn: () => endpoints.getBill(id),
    enabled: Boolean(id),
  });
}

export function useGenerateBills() {
  return useMutation({
    mutationFn: ({
      periodStart,
      periodEnd,
      customerId,
    }: {
      periodStart: string;
      periodEnd: string;
      customerId?: string;
    }) => endpoints.generateBills(periodStart, periodEnd, customerId),
    onSuccess: () => invalidateMoney(),
  });
}

export function useMarkBillPaid(billId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { amountPaid: number; paidOn: string; note?: string }) =>
      endpoints.markBillPaid(billId, input),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: keys.bill(billId) });
      await invalidateMoney();
    },
  });
}

export function useSendBillWhatsApp(billId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => endpoints.sendBillWhatsApp(billId),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: keys.bill(billId) });
      await invalidateMoney();
    },
  });
}

export function useSendAllBills() {
  return useMutation({
    mutationFn: ({ periodStart, periodEnd }: { periodStart: string; periodEnd: string }) =>
      endpoints.sendAllBills(periodStart, periodEnd),
    onSuccess: () => invalidateMoney(),
  });
}

// ── payments ────────────────────────────────────────────────────────────────
export function useRecordCollection() {
  return useMutation({
    mutationFn: endpoints.recordCollection,
    onSuccess: (_data, input) => invalidateMoney(input.customerId),
  });
}

export function useUpdateCollection(customerId: string) {
  return useMutation({
    mutationFn: ({
      paymentId,
      ...input
    }: {
      paymentId: string;
      amount: number;
      paidOn: string;
      note?: string;
    }) => endpoints.updateCollection(paymentId, input),
    onSuccess: () => invalidateMoney(customerId),
  });
}

export function useDeleteCollection(customerId: string) {
  return useMutation({
    mutationFn: endpoints.deleteCollection,
    onSuccess: () => invalidateMoney(customerId),
  });
}

// ── statement (quick bill) ──────────────────────────────────────────────────
export function usePreviewStatement() {
  return useMutation({
    mutationFn: ({ customerId, months }: { customerId: string; months: string[] }) =>
      endpoints.previewStatement(customerId, months),
  });
}

export function useSendStatement() {
  return useMutation({
    mutationFn: ({
      customerId,
      months,
      notes,
    }: {
      customerId: string;
      months: string[];
      notes?: string | null;
    }) => endpoints.sendStatement(customerId, months, notes),
    // Sending builds the underlying monthly bills, so billing views change.
    onSuccess: (_data, input) => invalidateMoney(input.customerId),
  });
}

// ── reports, settings, users ────────────────────────────────────────────────
export function useReports() {
  return useQuery({ queryKey: keys.reports, queryFn: endpoints.getReports });
}

export function useSettings() {
  return useQuery({
    queryKey: keys.settings,
    queryFn: endpoints.getSettings,
    // Settings drive the entry mode and the global rate; they change rarely but
    // must not be wrong, so they are cached for a few minutes rather than
    // indefinitely.
    staleTime: 5 * 60_000,
  });
}

export function useUpdateSettings() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: endpoints.updateSettings,
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: keys.settings });
      // The entry mode and global rate feed the entry and billing screens.
      await invalidateEntries();
      await client.invalidateQueries({ queryKey: ["billing"] });
    },
  });
}

export function useUsers() {
  return useQuery({ queryKey: keys.users, queryFn: endpoints.getUsers });
}

export function useCreateUser() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: endpoints.createUser,
    onSuccess: () => client.invalidateQueries({ queryKey: keys.users }),
  });
}

export function useDeleteUser() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: endpoints.deleteUser,
    onSuccess: () => client.invalidateQueries({ queryKey: keys.users }),
  });
}

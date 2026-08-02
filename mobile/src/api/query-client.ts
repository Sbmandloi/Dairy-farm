import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "./errors";

/**
 * Query cache configuration.
 *
 * The client already retries transient network failures itself, so React Query
 * is told not to retry on top of that — otherwise a dead connection becomes
 * 3 × 3 = 9 attempts and the user waits a minute to be told they are offline.
 *
 * `staleTime` is short because this is shared, multi-user data: a farmer
 * collecting cash in the field and a family member editing on the laptop must
 * not see each other's figures go stale for long. `gcTime` is long so the last
 * fetched screen still renders instantly, and offline, when the app is reopened.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 24 * 60 * 60 * 1000,
      retry: false,
      // Data is refetched when the app returns to the foreground rather than on
      // every mount, which keeps tab switches instant.
      refetchOnMount: true,
      refetchOnReconnect: true,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});

/**
 * Query keys.
 *
 * Grouped by feature and always arrays, so a whole feature can be invalidated
 * with a prefix. The relationships here mirror the web app's revalidatePath
 * calls: recording a payment there revalidates the customer manager, customers,
 * billing, dashboard and reports, so it must invalidate the same set here.
 */
export const keys = {
  dashboard: ["dashboard"] as const,

  customers: ["customers"] as const,
  customerList: (filter: unknown) => ["customers", "list", filter] as const,
  customer: (id: string) => ["customers", "detail", id] as const,
  customerPayments: (id: string) => ["customers", "payments", id] as const,

  customerManager: ["customer-manager"] as const,

  dailyEntry: (date: string) => ["daily-entry", date] as const,
  monthlyEntry: (year: number, month: number) => ["monthly-entry", year, month] as const,

  billing: (year: number, month: number) => ["billing", year, month] as const,
  bill: (id: string) => ["billing", "detail", id] as const,

  reports: ["reports"] as const,
  settings: ["settings"] as const,
  users: ["users"] as const,
} as const;

/**
 * Everything that goes stale when money moves.
 *
 * Collecting a payment changes a customer's dues, their bill's status, the
 * month's outstanding total, the dashboard's pending figure and the reports —
 * exactly the surfaces `revalidateMoney` refreshes on the web.
 */
export function invalidateMoney(customerId?: string): Promise<unknown> {
  const invalidations = [
    queryClient.invalidateQueries({ queryKey: keys.dashboard }),
    queryClient.invalidateQueries({ queryKey: keys.customers }),
    queryClient.invalidateQueries({ queryKey: keys.customerManager }),
    queryClient.invalidateQueries({ queryKey: ["billing"] }),
    queryClient.invalidateQueries({ queryKey: keys.reports }),
  ];
  if (customerId) {
    invalidations.push(
      queryClient.invalidateQueries({ queryKey: keys.customerPayments(customerId) })
    );
  }
  return Promise.all(invalidations);
}

/** Everything that goes stale when milk quantities change. */
export function invalidateEntries(): Promise<unknown> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ["daily-entry"] }),
    queryClient.invalidateQueries({ queryKey: ["monthly-entry"] }),
    queryClient.invalidateQueries({ queryKey: keys.dashboard }),
  ]);
}

/** Everything that goes stale when a customer is added, edited or archived. */
export function invalidateCustomers(id?: string): Promise<unknown> {
  const invalidations = [
    queryClient.invalidateQueries({ queryKey: keys.customers }),
    queryClient.invalidateQueries({ queryKey: keys.customerManager }),
    queryClient.invalidateQueries({ queryKey: keys.dashboard }),
    queryClient.invalidateQueries({ queryKey: ["billing"] }),
    queryClient.invalidateQueries({ queryKey: keys.reports }),
  ];
  if (id) {
    invalidations.push(queryClient.invalidateQueries({ queryKey: keys.customer(id) }));
  }
  return Promise.all(invalidations);
}

/** A dead session must not leave another account's data in the cache. */
export function clearCache(): void {
  queryClient.clear();
}

export function isOfflineError(error: unknown): boolean {
  return error instanceof ApiError && (error.kind === "network" || error.kind === "timeout");
}

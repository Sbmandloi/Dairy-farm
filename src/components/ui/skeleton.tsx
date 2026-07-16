import { cn } from "@/lib/utils";

/**
 * A shimmering placeholder block.
 *
 * Uses the shared `.skeleton` class from globals.css so every loading state in
 * the app shimmers identically. Size it with utility classes:
 *   <Skeleton className="h-4 w-32" />
 */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden="true" />;
}

/**
 * Placeholder for the sticky page <Header/>.
 *
 * The header is part of each page (not the layout), so every route skeleton must
 * reserve the same 56px bar — otherwise the real header pops in and shifts the
 * whole page down.
 */
export function HeaderSkeleton() {
  return (
    <div className="sticky top-0 z-20 flex items-center justify-between h-14 px-4 md:px-6 bg-white border-b border-gray-200">
      <Skeleton className="h-4 w-28" />
      <div className="flex items-center gap-3">
        <Skeleton className="h-3.5 w-20 hidden sm:block" />
        <Skeleton className="h-7 w-7 rounded-full" />
      </div>
    </div>
  );
}

/** Row of stat tiles — mirrors the tinted icon tiles used across the app. */
export function StatTilesSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-3",
        count === 5 ? "lg:grid-cols-5" : "lg:grid-cols-4"
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="border border-gray-100 rounded-xl p-3.5 flex items-center gap-3 bg-gray-50/60">
          <Skeleton className="w-9 h-9 rounded-lg flex-shrink-0" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-2.5 w-16" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Generic table placeholder: a header strip plus n rows of m columns. */
export function TableSkeleton({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex gap-4 px-4 py-3 bg-gray-50 border-b border-gray-200">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className={cn("h-3", i === 0 ? "flex-1" : "w-16")} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-4 py-3 border-b border-gray-100 last:border-0">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className={cn("h-3.5", c === 0 ? "flex-1 max-w-[180px]" : "w-16")} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Announces the loading state to screen readers without showing text. */
export function LoadingAnnouncer({ label = "Loading" }: { label?: string }) {
  return (
    <span role="status" aria-live="polite" className="sr-only">
      {label}
    </span>
  );
}

import {
  Skeleton,
  HeaderSkeleton,
  StatTilesSkeleton,
  LoadingAnnouncer,
} from "@/components/ui/skeleton";

export default function BillingLoading() {
  return (
    <div>
      <LoadingAnnouncer label="Loading billing" />
      <HeaderSkeleton />

      <div className="p-4 md:p-6 space-y-5">
        {/* Period + bulk actions card */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-2">
              <Skeleton className="h-2.5 w-28" />
              <Skeleton className="h-3.5 w-56" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-9 w-9 rounded-md" />
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-9 w-9 rounded-md" />
            </div>
          </div>
          <div className="pt-3 border-t border-gray-100 flex flex-wrap gap-3">
            <Skeleton className="h-9 w-40 rounded-md" />
            <Skeleton className="h-9 w-48 rounded-md" />
            <Skeleton className="h-9 w-36 rounded-md" />
          </div>
        </div>

        <StatTilesSkeleton count={4} />

        {/* Search + status tabs */}
        <div className="space-y-3">
          <Skeleton className="h-9 w-full max-w-md rounded-md" />
          <div className="flex gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-20 rounded-md" />
            ))}
          </div>
        </div>

        {/* Customer bill rows */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <div className="hidden md:flex gap-4 px-4 py-3 bg-gray-50 border-b border-gray-200">
            <Skeleton className="h-3 flex-1" />
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-3 w-16" />
            ))}
          </div>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="border-b border-gray-100 last:border-0 p-4 flex items-center gap-4">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-28" />
              </div>
              <Skeleton className="h-3.5 w-14 hidden md:block" />
              <Skeleton className="h-4 w-20 hidden md:block" />
              <Skeleton className="h-5 w-16 rounded-full hidden md:block" />
              <Skeleton className="h-3 w-20 hidden md:block" />
              <Skeleton className="h-8 w-24 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

import {
  Skeleton,
  HeaderSkeleton,
  StatTilesSkeleton,
  LoadingAnnouncer,
} from "@/components/ui/skeleton";

export default function CustomersLoading() {
  return (
    <div>
      <LoadingAnnouncer label="Loading customers" />
      <HeaderSkeleton />

      <div className="p-4 md:p-6 space-y-5">
        <StatTilesSkeleton count={4} />

        {/* Filter tabs + actions */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-20 rounded-md" />
            ))}
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-24 rounded-md" />
            <Skeleton className="h-8 w-32 rounded-md" />
          </div>
        </div>

        {/* Search */}
        <Skeleton className="h-9 w-full max-w-md rounded-md" />

        {/* Customer cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
              <div className="flex items-start gap-3">
                <Skeleton className="w-10 h-10 rounded-xl flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-40" />
                <Skeleton className="h-3 w-28" />
              </div>
              {/* Stats strip */}
              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-gray-100">
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className="space-y-1.5 flex flex-col items-center">
                    <Skeleton className="h-2.5 w-10" />
                    <Skeleton className="h-3.5 w-12" />
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-8 flex-1 rounded-md" />
                <Skeleton className="h-8 w-12 rounded-md" />
                <Skeleton className="h-8 w-8 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

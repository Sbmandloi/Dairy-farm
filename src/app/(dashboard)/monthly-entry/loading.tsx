import {
  Skeleton,
  HeaderSkeleton,
  StatTilesSkeleton,
  LoadingAnnouncer,
} from "@/components/ui/skeleton";

export default function MonthlyEntryLoading() {
  return (
    <div>
      <LoadingAnnouncer label="Loading monthly entry" />
      <HeaderSkeleton />

      <div className="p-4 md:p-6 space-y-4">
        {/* Month navigator card */}
        <div className="bg-white border border-gray-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-9 rounded-md" />
            <div className="min-w-[150px] flex flex-col items-center gap-1.5">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-2.5 w-32" />
            </div>
            <Skeleton className="h-9 w-9 rounded-md" />
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-40 rounded-md" />
            <Skeleton className="h-8 w-32 rounded-md" />
          </div>
        </div>

        <StatTilesSkeleton count={4} />

        {/* Spreadsheet grid */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-3 py-2 bg-gray-50/60 border-b border-gray-100">
            <Skeleton className="h-3 w-64 hidden sm:block" />
            <div className="flex gap-1 ml-auto">
              <Skeleton className="h-7 w-7 rounded-md" />
              <Skeleton className="h-7 w-14 rounded-md" />
              <Skeleton className="h-7 w-7 rounded-md" />
            </div>
          </div>

          {/* Day header strip */}
          <div className="flex gap-1 px-3 py-2 bg-gray-50 border-b-2 border-gray-200">
            <Skeleton className="h-6 w-[132px] flex-shrink-0" />
            {Array.from({ length: 14 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-11 flex-shrink-0" />
            ))}
          </div>

          {/* Customer rows */}
          {Array.from({ length: 6 }).map((_, r) => (
            <div key={r} className="flex gap-1 px-3 py-2.5 border-b border-gray-100 last:border-0 items-center">
              <div className="flex items-center gap-2 w-[132px] flex-shrink-0">
                <Skeleton className="w-7 h-7 rounded-lg flex-shrink-0" />
                <Skeleton className="h-3 w-20" />
              </div>
              {Array.from({ length: 14 }).map((_, c) => (
                <Skeleton key={c} className="h-9 w-11 flex-shrink-0 rounded" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

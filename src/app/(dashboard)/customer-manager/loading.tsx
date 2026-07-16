import {
  Skeleton,
  HeaderSkeleton,
  StatTilesSkeleton,
  LoadingAnnouncer,
} from "@/components/ui/skeleton";

export default function CustomerManagerLoading() {
  return (
    <div>
      <LoadingAnnouncer label="Loading customer manager" />
      <HeaderSkeleton />

      <div className="p-4 md:p-6 space-y-5">
        {/* Intro */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <Skeleton className="hidden sm:block w-10 h-10 rounded-xl flex-shrink-0" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-56" />
              <Skeleton className="h-3.5 w-80 max-w-full" />
            </div>
          </div>
          <Skeleton className="h-8 w-32 rounded-md flex-shrink-0" />
        </div>

        <StatTilesSkeleton count={5} />

        {/* Toolbar: search + filters */}
        <div className="bg-white border border-gray-200 rounded-xl p-3 space-y-3">
          <Skeleton className="h-10 w-full rounded-lg" />
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Skeleton className="h-3 w-12" />
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-6 w-16 rounded-md" />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-3 w-14" />
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-6 w-16 rounded-md" />
              ))}
            </div>
          </div>
        </div>

        {/* Dense editable table */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="flex gap-3 px-3 py-2.5 bg-gray-50 border-b border-gray-200">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className={i === 0 ? "h-3 flex-1" : "h-3 w-16"} />
            ))}
          </div>
          {Array.from({ length: 7 }).map((_, r) => (
            <div key={r} className="flex items-center gap-3 px-3 py-3 border-b border-gray-100 last:border-0">
              <div className="flex items-center gap-2.5 flex-1">
                <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
                <Skeleton className="h-3.5 w-28" />
              </div>
              {Array.from({ length: 7 }).map((_, c) => (
                <Skeleton key={c} className="h-3.5 w-16" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

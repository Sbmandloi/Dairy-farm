import {
  Skeleton,
  HeaderSkeleton,
  StatTilesSkeleton,
  LoadingAnnouncer,
} from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div>
      <LoadingAnnouncer label="Loading dashboard" />
      <HeaderSkeleton />

      <div className="p-4 md:p-6 space-y-6">
        {/* Greeting */}
        <div className="space-y-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-3.5 w-32" />
        </div>

        <StatTilesSkeleton count={4} />

        {/* Today's progress */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-3 w-28" />
          </div>
          <Skeleton className="h-2 w-full rounded-full" />
        </div>

        {/* Today's entries + Pending bills */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="border border-gray-200 rounded-xl p-4 bg-white space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-8 w-24 rounded-md" />
              </div>
              {Array.from({ length: 5 }).map((_, j) => (
                <div key={j} className="flex items-center justify-between py-1">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-3.5 w-14" />
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

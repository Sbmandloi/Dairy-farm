import {
  Skeleton,
  HeaderSkeleton,
  StatTilesSkeleton,
  TableSkeleton,
  LoadingAnnouncer,
} from "@/components/ui/skeleton";

export default function ReportsLoading() {
  return (
    <div>
      <LoadingAnnouncer label="Loading reports" />
      <HeaderSkeleton />

      <div className="p-4 md:p-6 space-y-6">
        {/* Intro */}
        <div className="flex items-start gap-3">
          <Skeleton className="hidden sm:block w-10 h-10 rounded-xl flex-shrink-0" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-3.5 w-80 max-w-full" />
          </div>
        </div>

        <StatTilesSkeleton count={5} />

        {/* Tabs */}
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-36 rounded-md" />
          ))}
        </div>

        {/* Active tab table */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-56" />
          <TableSkeleton rows={7} cols={4} />
        </div>
      </div>
    </div>
  );
}

import { Skeleton, HeaderSkeleton, LoadingAnnouncer } from "@/components/ui/skeleton";

export default function DailyEntryLoading() {
  return (
    <div>
      <LoadingAnnouncer label="Loading daily entry" />
      <HeaderSkeleton />

      <div className="p-4 md:p-6 space-y-4">
        {/* Date navigator */}
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-md" />
          <div className="flex-1 flex justify-center">
            <Skeleton className="h-5 w-40" />
          </div>
          <Skeleton className="h-9 w-9 rounded-md" />
          <Skeleton className="h-9 w-36 rounded-md" />
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="border border-gray-200 rounded-xl p-3 bg-white flex flex-col items-center gap-2">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-2.5 w-16" />
              <Skeleton className="h-4 w-14" />
            </div>
          ))}
        </div>

        {/* Search + toolbar */}
        <Skeleton className="h-9 w-full max-w-md rounded-md" />
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-40" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-40 rounded-md" />
            <Skeleton className="h-8 w-24 rounded-md" />
          </div>
        </div>

        {/* Entry rows */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="flex gap-4 px-4 py-3 bg-gray-50 border-b border-gray-200">
            <Skeleton className="h-3 flex-1" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-16" />
          </div>
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-gray-100 last:border-0">
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-2.5 w-24" />
              </div>
              <Skeleton className="h-10 w-20 rounded-md" />
              <Skeleton className="h-10 w-20 rounded-md" />
              <Skeleton className="h-4 w-14" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

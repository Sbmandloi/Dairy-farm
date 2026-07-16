import { Skeleton, HeaderSkeleton, LoadingAnnouncer } from "@/components/ui/skeleton";

export default function CustomerDetailLoading() {
  return (
    <div>
      <LoadingAnnouncer label="Loading customer" />
      <HeaderSkeleton />

      <div className="p-4 md:p-6 space-y-5">
        <Skeleton className="h-3.5 w-36" />

        {/* Hero card */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {/* Banner */}
          <Skeleton className="h-24 w-full rounded-none" />
          <div className="px-5 pb-5">
            <div className="flex items-end justify-between -mt-8 mb-4">
              <Skeleton className="w-16 h-16 rounded-2xl border-4 border-white" />
              <div className="flex gap-2 pb-0.5">
                <Skeleton className="h-8 w-20 rounded-md" />
                <Skeleton className="h-8 w-24 rounded-md" />
              </div>
            </div>

            {/* Name + badges */}
            <div className="flex items-center gap-2 mb-3">
              <Skeleton className="h-6 w-44" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>

            {/* Contact chips */}
            <div className="flex flex-wrap gap-2 mb-5">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-6 w-32 rounded-full" />
              ))}
            </div>

            {/* Collection progress */}
            <div className="mb-5 space-y-2">
              <div className="flex justify-between">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-40" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
            </div>

            {/* KPI row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-gray-100">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex flex-col items-center gap-1.5">
                  <Skeleton className="w-8 h-8 rounded-full" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-2.5 w-14" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-28 rounded-md" />
          ))}
        </div>

        {/* Tab content */}
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl">
              <div className="space-y-2">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-44" />
              </div>
              <div className="space-y-2 flex flex-col items-end">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

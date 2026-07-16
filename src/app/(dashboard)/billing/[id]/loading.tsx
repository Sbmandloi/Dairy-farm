import {
  Skeleton,
  HeaderSkeleton,
  TableSkeleton,
  LoadingAnnouncer,
} from "@/components/ui/skeleton";

export default function BillDetailLoading() {
  return (
    <div>
      <LoadingAnnouncer label="Loading bill" />
      <HeaderSkeleton />

      <div className="p-4 md:p-6 space-y-5">
        <Skeleton className="h-3.5 w-28" />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Bill summary card */}
          <div className="lg:col-span-1 bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3 w-32" />
            </div>

            <div className="space-y-2 pt-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex justify-between">
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-3.5 w-20" />
                </div>
              ))}
            </div>

            {/* Customer block */}
            <div className="pt-4 border-t border-gray-100 space-y-2">
              <Skeleton className="h-2.5 w-20" />
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-3 w-40" />
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2 pt-2">
              <Skeleton className="h-8 w-28 rounded-md" />
              <Skeleton className="h-8 w-32 rounded-md" />
              <Skeleton className="h-8 w-28 rounded-md" />
            </div>
          </div>

          {/* Breakdown */}
          <div className="lg:col-span-2 space-y-2">
            <Skeleton className="h-4 w-36" />
            <TableSkeleton rows={8} cols={4} />
          </div>
        </div>
      </div>
    </div>
  );
}

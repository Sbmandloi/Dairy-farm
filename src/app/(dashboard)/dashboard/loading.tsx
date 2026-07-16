export default function DashboardLoading() {
  return (
    <div>
      {/* Header placeholder */}
      <div className="sticky top-0 z-20 flex items-center justify-between h-14 px-4 md:px-6 bg-white border-b border-gray-200">
        <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
        <div className="h-7 w-7 bg-gray-200 rounded-full animate-pulse" />
      </div>

      <div className="p-4 md:p-6 space-y-6">
        {/* Greeting */}
        <div className="space-y-2">
          <div className="h-5 w-48 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-32 bg-gray-100 rounded animate-pulse" />
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="border border-gray-100 rounded-xl p-4 bg-gray-50">
              <div className="h-3 w-20 bg-gray-200 rounded animate-pulse" />
              <div className="h-6 w-16 bg-gray-200 rounded mt-2 animate-pulse" />
              <div className="h-3 w-24 bg-gray-100 rounded mt-2 animate-pulse" />
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="h-3 w-40 bg-gray-200 rounded animate-pulse" />
          <div className="h-2 w-full bg-gray-100 rounded-full mt-3 animate-pulse" />
        </div>

        {/* Two panels */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="border border-gray-200 rounded-xl p-4 bg-white space-y-3">
              <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
              {Array.from({ length: 5 }).map((_, j) => (
                <div key={j} className="flex items-center justify-between">
                  <div className="h-3 w-28 bg-gray-100 rounded animate-pulse" />
                  <div className="h-3 w-12 bg-gray-100 rounded animate-pulse" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

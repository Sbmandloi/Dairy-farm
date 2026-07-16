"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { formatDate } from "@/lib/utils/format";
import { addDays, isToday, parseDateOnly, todayInAppTz } from "@/lib/utils/date";

interface DateNavigatorProps {
  currentDate: string;
}

export function DateNavigator({ currentDate }: DateNavigatorProps) {
  const router = useRouter();
  const today = todayInAppTz();
  const atToday = isToday(currentDate);

  function navigate(days: number) {
    router.push(`/daily-entry?date=${addDays(currentDate, days)}`);
  }

  return (
    <div className="flex items-center gap-3">
      <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
        <ChevronLeft className="w-4 h-4" />
      </Button>

      <div className="flex items-center gap-2 flex-1 justify-center">
        <CalendarDays className="w-4 h-4 text-gray-400" />
        <span className="font-semibold text-gray-900">{formatDate(parseDateOnly(currentDate))}</span>
        {atToday && (
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Today</span>
        )}
      </div>

      <div className="flex gap-2">
        <Button variant="outline" size="icon" onClick={() => navigate(1)} disabled={atToday}>
          <ChevronRight className="w-4 h-4" />
        </Button>
        {!atToday && (
          <Button variant="outline" size="sm" onClick={() => router.push("/daily-entry")}>
            Today
          </Button>
        )}
      </div>

      {/* Date picker */}
      <input
        type="date"
        value={currentDate}
        max={today}
        onChange={(e) => router.push(`/daily-entry?date=${e.target.value}`)}
        className="h-9 rounded-md border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { currentYearMonth } from "@/lib/utils/date";

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

interface MonthPickerProps {
  year: number;
  month: number;
}

export function MonthPicker({ year, month }: MonthPickerProps) {
  const router = useRouter();
  // "Current" is the dairy's month (IST), not the server/browser's local month.
  const now = currentYearMonth();
  const isCurrentMonth = year === now.year && month === now.month;
  // Don't let the user bill a month that hasn't started yet.
  const isFutureBlocked = year > now.year || (year === now.year && month >= now.month);

  function navigate(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    router.push(`/billing?year=${y}&month=${m}`);
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon" onClick={() => navigate(-1)} title="Previous month">
        <ChevronLeft className="w-4 h-4" />
      </Button>

      <div className="text-center min-w-[140px]">
        <p className="font-semibold text-gray-900">
          {MONTH_NAMES[month - 1]} {year}
        </p>
        {isCurrentMonth && (
          <p className="text-xs text-blue-500 font-medium">Current month</p>
        )}
      </div>

      <Button
        variant="outline"
        size="icon"
        onClick={() => navigate(1)}
        disabled={isFutureBlocked}
        title={isFutureBlocked ? "Can't bill a future month" : "Next month"}
      >
        <ChevronRight className="w-4 h-4" />
      </Button>

      {!isCurrentMonth && (
        <Button
          variant="ghost"
          size="sm"
          className="text-blue-600"
          onClick={() => router.push("/billing")}
        >
          This month
        </Button>
      )}
    </div>
  );
}

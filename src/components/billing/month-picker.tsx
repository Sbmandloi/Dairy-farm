"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatMonth } from "@/lib/utils/format";

interface MonthPickerProps {
  year: number;
  month: number;
}

export function MonthPicker({ year, month }: MonthPickerProps) {
  const router = useRouter();

  function navigate(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    router.push(`/billing?year=${y}&month=${m}`);
  }

  const date = new Date(year, month - 1, 1);
  const isCurrentMonth = year === new Date().getFullYear() && month === new Date().getMonth() + 1;

  return (
    <div className="flex items-center gap-3">
      <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
        <ChevronLeft className="w-4 h-4" />
      </Button>
      <div className="text-center">
        <p className="font-semibold text-gray-900">{formatMonth(date)}</p>
        {isCurrentMonth && <p className="text-xs text-blue-500 font-medium">Current Month</p>}
      </div>
      <Button variant="outline" size="icon" onClick={() => navigate(1)} disabled={isCurrentMonth}>
        <ChevronRight className="w-4 h-4" />
      </Button>
    </div>
  );
}

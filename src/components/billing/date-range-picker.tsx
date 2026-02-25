"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarRange } from "lucide-react";

interface DateRangePickerProps {
  from: string; // "YYYY-MM-DD"
  to: string;   // "YYYY-MM-DD"
}

const today = () => new Date().toISOString().split("T")[0];

function localDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const PRESETS = [
  {
    label: "This Month",
    get() {
      const n = new Date();
      return {
        from: localDate(new Date(n.getFullYear(), n.getMonth(), 1)),
        to: localDate(new Date(n.getFullYear(), n.getMonth() + 1, 0)),
      };
    },
  },
  {
    label: "Last Month",
    get() {
      const n = new Date();
      return {
        from: localDate(new Date(n.getFullYear(), n.getMonth() - 1, 1)),
        to: localDate(new Date(n.getFullYear(), n.getMonth(), 0)),
      };
    },
  },
  {
    label: "Last 7 Days",
    get() {
      const n = new Date();
      const f = new Date(n);
      f.setDate(n.getDate() - 6);
      return { from: localDate(f), to: localDate(n) };
    },
  },
  {
    label: "Last 30 Days",
    get() {
      const n = new Date();
      const f = new Date(n);
      f.setDate(n.getDate() - 29);
      return { from: localDate(f), to: localDate(n) };
    },
  },
];

export function DateRangePicker({ from, to }: DateRangePickerProps) {
  const router = useRouter();
  const [fromVal, setFromVal] = useState(from);
  const [toVal, setToVal] = useState(to);

  function navigate(f: string, t: string) {
    router.push(`/billing?from=${f}&to=${t}`);
  }

  function applyCustom() {
    if (fromVal && toVal && fromVal <= toVal) {
      navigate(fromVal, toVal);
    }
  }

  // Figure out which preset is active (if any)
  const activePreset = PRESETS.find((p) => {
    const r = p.get();
    return r.from === from && r.to === to;
  })?.label;

  return (
    <div className="flex flex-col gap-3">
      {/* Preset buttons */}
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => {
          const isActive = p.label === activePreset;
          return (
            <button
              key={p.label}
              onClick={() => {
                const r = p.get();
                setFromVal(r.from);
                setToVal(r.to);
                navigate(r.from, r.to);
              }}
              className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-all ${
                isActive
                  ? "bg-blue-600 text-white border-blue-600"
                  : "border-gray-200 text-gray-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700"
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* Custom range inputs */}
      <div className="flex items-center gap-2 flex-wrap">
        <CalendarRange className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm">
          <div className="flex flex-col">
            <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">From</span>
            <input
              type="date"
              value={fromVal}
              max={toVal || today()}
              onChange={(e) => setFromVal(e.target.value)}
              className="text-sm text-gray-800 outline-none cursor-pointer"
            />
          </div>
          <span className="text-gray-300 mx-2 text-lg font-light">—</span>
          <div className="flex flex-col">
            <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">To</span>
            <input
              type="date"
              value={toVal}
              min={fromVal}
              max={today()}
              onChange={(e) => setToVal(e.target.value)}
              className="text-sm text-gray-800 outline-none cursor-pointer"
            />
          </div>
        </div>
        <button
          onClick={applyCustom}
          disabled={!fromVal || !toVal || fromVal > toVal}
          className="text-sm font-semibold px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Apply
        </button>
      </div>
    </div>
  );
}

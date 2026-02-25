"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2, ChevronDown } from "lucide-react";

export function ExportButton() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  async function download(period: string, label: string) {
    setLoading(label);
    setOpen(false);
    try {
      const res = await fetch(`/api/export/customers?period=${period}`);
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `customers-${period}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert("Export failed. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  const now = new Date();
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return {
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleString("en-IN", { month: "short", year: "numeric" }),
    };
  });

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        disabled={!!loading}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Download className="w-4 h-4" />
        )}
        Export
        <ChevronDown className="w-3 h-3 ml-1" />
      </Button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-9 z-20 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[180px]">
            <p className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
              All Time
            </p>
            <button
              onClick={() => download("all", "All")}
              className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 text-gray-700 hover:text-blue-600 transition-colors"
            >
              All Customers (CSV)
            </button>
            <div className="border-t border-gray-100 my-1" />
            <p className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
              By Month
            </p>
            {months.map((m) => (
              <button
                key={m.value}
                onClick={() => download(m.value, m.label)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 text-gray-700 hover:text-blue-600 transition-colors"
              >
                {m.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

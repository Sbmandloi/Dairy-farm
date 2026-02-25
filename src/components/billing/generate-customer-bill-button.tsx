"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { generateBillsAction } from "@/lib/actions/billing.actions";
import { Loader2, RefreshCw } from "lucide-react";

interface GenerateCustomerBillButtonProps {
  customerId: string;
  periodStart: string;
  periodEnd: string;
  /** If a bill already exists, this button acts as "Regenerate" */
  hasBill?: boolean;
}

export function GenerateCustomerBillButton({
  customerId,
  periodStart,
  periodEnd,
  hasBill = false,
}: GenerateCustomerBillButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleClick() {
    setLoading(true);
    setMessage("");
    const result = await generateBillsAction(periodStart, periodEnd, customerId);
    setLoading(false);
    if (result.success) {
      setMessage(result.data.length > 0 ? "✓" : "No entries");
      router.refresh();
    } else {
      setMessage("Error");
    }
  }

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={handleClick}
        disabled={loading}
        title={hasBill ? "Regenerate bill" : "Generate bill"}
        className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
          hasBill
            ? "border-gray-200 text-gray-600 hover:bg-gray-50"
            : "border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100"
        }`}
      >
        {loading ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <RefreshCw className="w-3 h-3" />
        )}
        {hasBill ? "Regen" : "Generate"}
      </button>
      {message && (
        <span
          className={`text-xs font-medium ${
            message.startsWith("Error") ? "text-red-500" : message === "No entries" ? "text-gray-400" : "text-green-600"
          }`}
        >
          {message}
        </span>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { generateBillsAction, sendAllBillsWhatsAppAction } from "@/lib/actions/billing.actions";
import { Loader2, RefreshCw, Send } from "lucide-react";

interface BillingControlsProps {
  periodStart: string;
  periodEnd: string;
  billCount: number;
}

export function BillingControls({ periodStart, periodEnd, billCount }: BillingControlsProps) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");

  async function handleGenerate() {
    setGenerating(true);
    setMessage("");
    const result = await generateBillsAction(periodStart, periodEnd);
    setGenerating(false);
    if (result.success) {
      setMessage(`✓ Generated ${result.data.length} bill(s)`);
      router.refresh();
    } else {
      setMessage(`Error: ${result.error}`);
    }
  }

  async function handleSendAll() {
    setSending(true);
    setMessage("");
    const result = await sendAllBillsWhatsAppAction(periodStart, periodEnd);
    setSending(false);
    if (result.success) {
      const ok = result.data.filter((r) => r.success).length;
      const fail = result.data.filter((r) => !r.success).length;
      setMessage(`✓ Sent ${ok} bill(s)${fail > 0 ? `, ${fail} failed` : ""}`);
      router.refresh();
    } else {
      setMessage(`Error: ${result.error}`);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button onClick={handleGenerate} disabled={generating} variant="default">
        {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        {generating ? "Generating..." : "Generate All Bills"}
      </Button>

      {billCount > 0 && (
        <Button onClick={handleSendAll} disabled={sending} variant="outline">
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {sending ? "Sending..." : `Send All via WhatsApp`}
        </Button>
      )}

      {message && (
        <span className={`text-sm font-medium ${message.startsWith("Error") ? "text-red-600" : "text-green-600"}`}>
          {message}
        </span>
      )}
    </div>
  );
}

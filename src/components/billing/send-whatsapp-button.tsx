"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { sendBillWhatsAppAction } from "@/lib/actions/billing.actions";
import { Loader2, Send, CheckCircle } from "lucide-react";
import { useRouter } from "next/navigation";

interface SendWhatsAppButtonProps {
  billId: string;
  disabled?: boolean;
}

export function SendWhatsAppButton({ billId, disabled }: SendWhatsAppButtonProps) {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSend() {
    setLoading(true);
    setError("");
    const result = await sendBillWhatsAppAction(billId);
    setLoading(false);
    if (result.success) {
      setSent(true);
      router.refresh();
    } else {
      setError(result.error);
    }
  }

  if (sent) {
    return (
      <div className="flex items-center gap-1.5 text-green-600 text-sm font-medium">
        <CheckCircle className="w-4 h-4" />
        Sent!
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Button onClick={handleSend} disabled={loading || disabled} size="sm" variant="outline">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 text-green-600" />}
        {loading ? "Sending..." : "Send WhatsApp"}
      </Button>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

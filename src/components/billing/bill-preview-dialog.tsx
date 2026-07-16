"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { sendBillWhatsAppAction } from "@/lib/actions/billing.actions";
import { Eye, Loader2, Send, Download, CheckCircle2, AlertCircle } from "lucide-react";

interface BillPreviewDialogProps {
  billId: string;
  invoiceNumber: string;
  customerName: string;
  /** No phone → WhatsApp can't be sent; preview still works. */
  canSend?: boolean;
  triggerLabel?: string;
  iconOnly?: boolean;
}

/**
 * Preview the generated bill PDF before it goes out on WhatsApp, and send it
 * straight from the preview once it looks right.
 */
export function BillPreviewDialog({
  billId,
  invoiceNumber,
  customerName,
  canSend = true,
  triggerLabel = "Preview",
  iconOnly,
}: BillPreviewDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSend() {
    setSending(true);
    setError("");
    const result = await sendBillWhatsAppAction(billId);
    setSending(false);
    if (result.success) {
      setSent(true);
      router.refresh();
    } else {
      setError(result.error);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size={iconOnly ? "icon" : "sm"}
        onClick={() => setOpen(true)}
        title={`Preview ${invoiceNumber}`}
      >
        <Eye className="w-4 h-4" />
        {!iconOnly && triggerLabel}
      </Button>

      <Dialog open={open} onOpenChange={(o) => !sending && setOpen(o)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-base">
              {invoiceNumber} · {customerName}
            </DialogTitle>
          </DialogHeader>

          {/* The PDF itself — rendered inline, exactly what the customer receives */}
          <div className="h-[65vh] w-full rounded-lg border border-gray-200 bg-gray-50 overflow-hidden">
            {open && (
              <iframe
                src={`/api/billing/${billId}/pdf?inline=1`}
                title={`Bill ${invoiceNumber}`}
                className="w-full h-full"
              />
            )}
          </div>

          {error && (
            <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          {sent && (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              Sent to {customerName} on WhatsApp.
            </div>
          )}

          <DialogFooter className="gap-2 sm:justify-between">
            <a href={`/api/billing/${billId}/pdf`} download>
              <Button variant="outline" size="sm" type="button">
                <Download className="w-4 h-4" />
                Download PDF
              </Button>
            </a>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={sending}>
                Close
              </Button>
              {!sent && (
                <Button
                  size="sm"
                  onClick={handleSend}
                  disabled={sending || !canSend}
                  title={canSend ? "Send this bill on WhatsApp" : "Customer has no phone number"}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {sending ? "Sending…" : "Send on WhatsApp"}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

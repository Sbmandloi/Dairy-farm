"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { generateBillsAction, sendAllBillsWhatsAppAction } from "@/lib/actions/billing.actions";
import { Loader2, RefreshCw, Send, CheckCircle2, AlertCircle, Printer } from "lucide-react";

interface BillingControlsProps {
  periodStart: string;
  periodEnd: string;
  billCount: number;
  customerCount: number;
  withoutBill: number;
  /** Bills with a phone number that aren't fully paid — i.e. actually sendable. */
  sendableCount: number;
  year: number;
  month: number;
}

type Failure = { customerName: string; error?: string };

export function BillingControls({
  periodStart,
  periodEnd,
  billCount,
  customerCount,
  withoutBill,
  sendableCount,
  year,
  month,
}: BillingControlsProps) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [ok, setOk] = useState("");
  const [error, setError] = useState("");
  const [failures, setFailures] = useState<Failure[]>([]);

  function reset() {
    setOk("");
    setError("");
    setFailures([]);
  }

  /**
   * Save every generated bill for the month as one PDF (a bill per page).
   * Fetched rather than linked so a "no bills yet" response surfaces as a
   * message instead of navigating the user to a JSON error page.
   */
  async function handlePrintAll() {
    setPrinting(true);
    reset();
    try {
      const res = await fetch(`/api/billing/print-all?year=${year}&month=${month}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Could not build the bills PDF.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bills-${year}-${String(month).padStart(2, "0")}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setOk(`Saved ${billCount} bill${billCount === 1 ? "" : "s"} to one PDF — open it to print.`);
    } catch {
      setError("Download failed. Please try again.");
    } finally {
      setPrinting(false);
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    reset();
    const result = await generateBillsAction(periodStart, periodEnd);
    setGenerating(false);
    if (result.success) {
      const n = result.data.length;
      setOk(
        n === 0
          ? "No bills generated — there are no milk entries in this period."
          : `Generated ${n} bill${n === 1 ? "" : "s"} for this month.`
      );
      router.refresh();
    } else {
      setError(result.error);
    }
  }

  async function handleSendAll() {
    setSending(true);
    reset();
    const result = await sendAllBillsWhatsAppAction(periodStart, periodEnd);
    setSending(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    const sent = result.data.filter((r) => r.success);
    const failed = result.data.filter((r) => !r.success);
    setFailures(failed.map((f) => ({ customerName: f.customerName, error: f.error })));
    setOk(
      result.data.length === 0
        ? "Nothing to send — bills are already sent/paid, or those customers have no phone number."
        : `Sent ${sent.length} bill${sent.length === 1 ? "" : "s"} on WhatsApp${failed.length ? `, ${failed.length} failed` : ""}.`
    );
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={handleGenerate} disabled={generating || sending}>
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {generating ? "Generating…" : "Generate All Bills"}
        </Button>

        <Button
          onClick={handleSendAll}
          disabled={sending || generating || sendableCount === 0}
          variant="outline"
          className="border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800"
          title={
            sendableCount === 0
              ? "No bills pending send (already sent/paid, or no phone number on file)"
              : `Send ${sendableCount} bill(s) on WhatsApp`
          }
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {sending ? "Sending…" : `Send All via WhatsApp${sendableCount ? ` (${sendableCount})` : ""}`}
        </Button>

        <Button
          onClick={handlePrintAll}
          disabled={printing || generating || sending || billCount === 0}
          variant="outline"
          title={
            billCount === 0
              ? "Generate bills first"
              : `Save all ${billCount} bill(s) as one PDF to print`
          }
        >
          {printing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
          {printing ? "Preparing…" : `Print All Bills${billCount ? ` (${billCount})` : ""}`}
        </Button>

        <p className="text-xs text-gray-500">
          {billCount} of {customerCount} customers billed
          {withoutBill > 0 && (
            <span className="text-amber-600"> · {withoutBill} without a bill</span>
          )}
        </p>
      </div>

      {ok && (
        <div className="flex items-start gap-2 text-sm text-green-800 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{ok}</span>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Name the customers that failed, so they can actually be fixed. */}
      {failures.length > 0 && (
        <div className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <p className="font-medium mb-1">Could not send to:</p>
          <ul className="space-y-0.5">
            {failures.map((f, i) => (
              <li key={i} className="text-xs">
                <span className="font-medium">{f.customerName}</span>
                {f.error ? <span className="text-amber-700"> — {f.error}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

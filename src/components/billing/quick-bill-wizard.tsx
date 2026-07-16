"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatCurrency, formatLiters } from "@/lib/utils/format";
import { todayInAppTz, monthsInRange, monthPeriod, currentYearMonth } from "@/lib/utils/date";
import {
  previewStatementAction,
  sendStatementAction,
  type StatementPreview,
} from "@/lib/actions/statement.actions";
import {
  Search,
  X,
  Loader2,
  Eye,
  Send,
  Printer,
  CheckCircle2,
  AlertCircle,
  Phone,
  IndianRupee,
  CalendarDays,
  ArrowLeft,
} from "lucide-react";

export interface QuickBillCustomer {
  id: string;
  name: string;
  phoneNumber: string | null;
  address: string | null;
  pricePerLiter: number | null;
}

interface FarmSettings {
  farmName: string;
  farmAddress: string | null;
  farmPhone: string | null;
  globalPricePerLiter: number;
}

interface Props {
  customers: QuickBillCustomer[];
  settings: FarmSettings;
}

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const AVATAR_COLORS = [
  "bg-blue-500","bg-emerald-500","bg-violet-500",
  "bg-orange-500","bg-rose-500","bg-teal-500",
  "bg-indigo-500","bg-amber-500",
];
function avatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

/** "2026-07" → "Jul 2026" */
function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

/**
 * Quick Bill: pick a customer, pick any months, and the system builds one bill
 * with a line per month. Quantity is summed from daily entries and the rate is
 * read from the database — neither is hand-entered.
 */
export function QuickBillWizard({ customers, settings }: Props) {
  const router = useRouter();

  // Default to the current month (1st → last) in the dairy's timezone.
  const defaults = useMemo(() => {
    const { year, month } = currentYearMonth();
    return monthPeriod(year, month);
  }, []);

  const [query, setQuery] = useState("");
  const [customer, setCustomer] = useState<QuickBillCustomer | null>(null);
  const [from, setFrom] = useState(defaults.start);
  const [to, setTo] = useState(defaults.end);
  const [notes, setNotes] = useState("");

  // Billing is whole-month, so the picked dates resolve to the months they touch.
  const selected = useMemo(() => monthsInRange(from, to), [from, to]);
  const invalidRange = from > to;

  const [preview, setPreview] = useState<StatementPreview | null>(null);
  const [loadingPreview, startPreview] = useTransition();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [ok, setOk] = useState("");
  const [error, setError] = useState("");

  const rate = customer?.pricePerLiter ?? settings.globalPricePerLiter;
  const isCustomRate = customer?.pricePerLiter != null;

  const visible = query
    ? customers.filter(
        (c) =>
          c.name.toLowerCase().includes(query.toLowerCase()) ||
          (c.phoneNumber?.includes(query) ?? false)
      )
    : customers;

  // Recompute the summary as months are toggled. Read-only: no bills are created
  // until the user previews, prints or sends.
  useEffect(() => {
    setOk("");
    setError("");
    if (!customer || selected.length === 0) {
      setPreview(null);
      return;
    }
    startPreview(async () => {
      const result = await previewStatementAction(customer.id, selected);
      if (result.success) setPreview(result.data);
      else {
        setPreview(null);
        setError(result.error);
      }
    });
  }, [customer, selected]);

  function reset() {
    setCustomer(null);
    setFrom(defaults.start);
    setTo(defaults.end);
    setNotes("");
    setPreview(null);
    setOk("");
    setError("");
  }

  const statementUrl = (inline: boolean) =>
    `/api/billing/statement?customerId=${customer!.id}` +
    `&months=${selected.slice().sort().join(",")}` +
    `&notes=${encodeURIComponent(notes)}${inline ? "&inline=1" : ""}`;

  const billableMonths = preview?.months.length ?? 0;
  const canAct = !!customer && billableMonths > 0 && !loadingPreview;

  async function handlePrint() {
    setPrinting(true);
    setError("");
    setOk("");
    try {
      const res = await fetch(statementUrl(false));
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Could not build the bill.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bill-${customer!.name.replace(/\s+/g, "-").toLowerCase()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setOk("Bill saved to your system — open it to print.");
      router.refresh();
    } catch {
      setError("Download failed. Please try again.");
    } finally {
      setPrinting(false);
    }
  }

  async function handleSend() {
    setSending(true);
    setError("");
    setOk("");
    const result = await sendStatementAction(customer!.id, selected, notes);
    setSending(false);
    if (result.success) {
      setOk(`Bill sent to ${customer!.name} on WhatsApp.`);
      router.refresh();
    } else {
      setError(result.error);
    }
  }

  // ── Step 1: pick a customer ────────────────────────────────────────────────
  if (!customer) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Who is this bill for?</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Pick a customer, then choose the months. Quantity and rate come from your
            records automatically.
          </p>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or phone…"
            className="w-full h-10 pl-9 pr-9 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {visible.map((c) => (
            <button
              key={c.id}
              onClick={() => setCustomer(c)}
              className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-xl text-left hover:border-blue-300 hover:shadow-sm transition-all"
            >
              <div className={cn("w-10 h-10 rounded-xl grid place-items-center flex-shrink-0", avatarColor(c.name))}>
                <span className="text-sm font-bold text-white">{getInitials(c.name)}</span>
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 truncate">{c.name}</p>
                <p className="text-xs text-gray-400 truncate">{c.phoneNumber ?? "No phone"}</p>
              </div>
            </button>
          ))}
          {visible.length === 0 && (
            <p className="col-span-full text-center text-sm text-gray-400 py-10">
              No customers match &ldquo;{query}&rdquo;
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── Step 2: months, summary, actions ───────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Selected customer */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn("w-11 h-11 rounded-xl grid place-items-center flex-shrink-0", avatarColor(customer.name))}>
            <span className="text-sm font-bold text-white">{getInitials(customer.name)}</span>
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 truncate">{customer.name}</p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500">
              <span className="inline-flex items-center gap-1">
                <Phone className="w-3 h-3" />
                {customer.phoneNumber ?? "No phone"}
              </span>
              {/* Rate is read from the database — never entered by hand. */}
              <span className="inline-flex items-center gap-1">
                <IndianRupee className="w-3 h-3" />
                {formatCurrency(rate)}/L
                <Badge variant={isCustomRate ? "info" : "secondary"} className="text-[10px] ml-1">
                  {isCustomRate ? "custom rate" : "global rate"}
                </Badge>
              </span>
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={reset} className="flex-shrink-0">
          <ArrowLeft className="w-4 h-4" />
          Change
        </Button>
      </div>

      {/* Period — picked from calendars */}
      <div>
        <p className="text-sm font-semibold text-gray-700 inline-flex items-center gap-1.5 mb-2">
          <CalendarDays className="w-4 h-4 text-gray-400" />
          Billing period
        </p>

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="from" className="text-xs text-gray-500">From date</label>
            <Input
              id="from"
              type="date"
              value={from}
              max={todayInAppTz()}
              onChange={(e) => setFrom(e.target.value)}
              className="mt-1 w-44"
            />
          </div>
          <div>
            <label htmlFor="to" className="text-xs text-gray-500">To date</label>
            <Input
              id="to"
              type="date"
              value={to}
              max={todayInAppTz()}
              onChange={(e) => setTo(e.target.value)}
              className="mt-1 w-44"
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-blue-600"
            onClick={() => {
              setFrom(defaults.start);
              setTo(defaults.end);
            }}
          >
            This month
          </Button>
        </div>

        {invalidRange ? (
          <p className="flex items-center gap-1.5 text-xs text-red-600 mt-2">
            <AlertCircle className="w-3.5 h-3.5" />
            The From date must be on or before the To date.
          </p>
        ) : (
          <div className="mt-2.5">
            {/* Billing is always whole-month, so show exactly which months these
                dates resolve to — no surprises about what gets charged. */}
            <p className="text-xs text-gray-500 mb-1.5">
              Billing {selected.length} month{selected.length === 1 ? "" : "s"} in full
              (1st → last of each):
            </p>
            <div className="flex flex-wrap gap-1.5">
              {selected.map((key) => {
                const empty = preview?.emptyMonths.includes(key);
                return (
                  <span
                    key={key}
                    title={empty ? "No milk entries in this month — it will be skipped" : undefined}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-xs font-medium border",
                      empty
                        ? "bg-gray-100 border-gray-200 text-gray-400 line-through"
                        : "bg-blue-50 border-blue-200 text-blue-700"
                    )}
                  >
                    {monthLabel(key)}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Live summary */}
      {selected.length > 0 && (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Bill summary</p>
            {loadingPreview && <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />}
          </div>

          {preview && preview.months.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500 border-b border-gray-100">
                      <th className="text-left px-4 py-2 font-medium">Month</th>
                      <th className="text-right px-4 py-2 font-medium">Quantity</th>
                      <th className="text-right px-4 py-2 font-medium">Rate</th>
                      <th className="text-right px-4 py-2 font-medium">Amount</th>
                      <th className="text-right px-4 py-2 font-medium">Paid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.months.map((m) => (
                      <tr key={m.key} className="border-b border-gray-50 last:border-0">
                        <td className="px-4 py-2 font-medium text-gray-800">
                          {monthLabel(m.key)}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-600">{formatLiters(m.liters)}</td>
                        <td className="px-4 py-2 text-right text-gray-500">{formatCurrency(m.pricePerLiter)}</td>
                        <td className="px-4 py-2 text-right font-semibold text-gray-900">{formatCurrency(m.amount)}</td>
                        <td className="px-4 py-2 text-right text-green-600">{formatCurrency(m.paid)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 border-t border-gray-200 font-semibold">
                      <td className="px-4 py-2.5 text-gray-800">Total</td>
                      <td className="px-4 py-2.5 text-right text-blue-600">{formatLiters(preview.totals.liters)}</td>
                      <td />
                      <td className="px-4 py-2.5 text-right text-gray-900">{formatCurrency(preview.totals.amount)}</td>
                      <td className="px-4 py-2.5 text-right text-green-600">{formatCurrency(preview.totals.paid)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div
                className={cn(
                  "px-4 py-3 flex items-center justify-between",
                  preview.totals.due > 0.01 ? "bg-orange-50" : "bg-green-50"
                )}
              >
                <span className={cn("text-sm font-semibold", preview.totals.due > 0.01 ? "text-orange-700" : "text-green-700")}>
                  Balance Due
                </span>
                <span className={cn("text-base font-bold", preview.totals.due > 0.01 ? "text-orange-700" : "text-green-700")}>
                  {formatCurrency(preview.totals.due)}
                </span>
              </div>
            </>
          ) : (
            <p className="px-4 py-8 text-center text-sm text-gray-400">
              {loadingPreview ? "Calculating…" : "No milk entries in the selected month(s)."}
            </p>
          )}

          {preview && preview.emptyMonths.length > 0 && preview.months.length > 0 && (
            <p className="px-4 py-2 text-xs text-amber-700 bg-amber-50 border-t border-amber-100">
              Skipped (no entries):{" "}
              {preview.emptyMonths.map(monthLabel).join(", ")}
            </p>
          )}
        </div>
      )}

      {/* Notes — optional */}
      <div>
        <label htmlFor="notes" className="text-sm font-medium text-gray-700">
          Notes <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="e.g. Please pay by the 10th"
          className="mt-1.5"
        />
        <p className="text-xs text-gray-400 mt-1">Shown on the bill under टिप्पणी.</p>
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

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-100">
        <Button variant="outline" onClick={() => setPreviewOpen(true)} disabled={!canAct}>
          <Eye className="w-4 h-4" />
          Preview
        </Button>
        <Button variant="outline" onClick={handlePrint} disabled={!canAct || printing}>
          {printing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
          {printing ? "Preparing…" : "Print / Save"}
        </Button>
        <Button
          onClick={handleSend}
          disabled={!canAct || sending || !customer.phoneNumber}
          className="bg-green-600 hover:bg-green-700"
          title={customer.phoneNumber ? "Send this bill on WhatsApp" : "Customer has no phone number"}
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {sending ? "Sending…" : "Send on WhatsApp"}
        </Button>
      </div>

      {/* Preview — the exact PDF the customer receives */}
      {previewOpen && canAct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setPreviewOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <p className="font-semibold text-gray-900">Bill preview — {customer.name}</p>
              <button
                onClick={() => setPreviewOpen(false)}
                className="p-1 rounded-md text-gray-400 hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <iframe src={statementUrl(true)} title="Bill preview" className="w-full h-[70vh] bg-gray-50" />
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import {
  Loader2,
  IndianRupee,
  CheckCircle2,
  AlertTriangle,
  Pencil,
  Trash2,
  X,
  Check,
  Receipt,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate, formatPeriod } from "@/lib/utils/format";
import type { ManagedCustomer } from "@/lib/services/customer.service";
import type { CollectionEntry, CollectionResult } from "@/lib/services/payment.service";
import {
  recordCollectionAction,
  updateCollectionAction,
  deleteCollectionAction,
} from "@/lib/actions/payment.actions";
import { todayInAppTz } from "@/lib/utils/date";

/**
 * Default "paid on" to the dairy's today (IST), not the browser's local day —
 * otherwise a payment taken late in the IST evening defaults to the wrong date
 * for anyone whose device sits west of UTC.
 */
function today(): string {
  return todayInAppTz();
}

interface Props {
  /** Mount one of these per customer (keyed by id) — the form is seeded on mount. */
  customer: ManagedCustomer;
  /** This customer's payment log, newest first. Comes from the server, so it
   *  re-arrives on its own after `onChanged` triggers a refresh. */
  history: CollectionEntry[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after anything is written, so the page behind can refresh its totals. */
  onChanged: () => void;
}

export function CollectPaymentDialog({
  customer,
  history,
  open,
  onOpenChange,
  onChanged,
}: Props) {
  const pending = customer.pendingAmount;
  const canCollect = pending > 0.01;

  const [tab, setTab] = useState<"record" | "history">("record");

  // ── Record form ───────────────────────────────────────────────────────────
  // Seeded once, from the dues as they stood when this dialog opened. Deliberately
  // not re-synced: `pending` drops the moment a collection is saved, and resetting
  // then would wipe the receipt the user is still reading.
  const [amount, setAmount] = useState(() => (canCollect ? pending.toFixed(2) : ""));
  const [paidOn, setPaidOn] = useState(today);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<CollectionResult | null>(null);

  async function handleRecord() {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Enter an amount greater than 0.");
      return;
    }

    setSaving(true);
    setError("");
    const result = await recordCollectionAction({
      customerId: customer.id,
      amount: Math.round(value * 100) / 100,
      paidOn,
      note: note.trim() || undefined,
    });
    setSaving(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    setReceipt(result.data);
    setNote("");
    setAmount("");
    onChanged();
  }

  const collected = history.reduce((s, p) => s + p.amount, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IndianRupee className="w-4 h-4 text-green-600" />
            Collection — {customer.name}
          </DialogTitle>
          <DialogDescription>
            Record money you collected, and see everything paid so far.
          </DialogDescription>
        </DialogHeader>

        {/* Where this customer stands right now. */}
        <div className="grid grid-cols-2 gap-2">
          <Summary
            label="Pending"
            value={formatCurrency(pending)}
            tone={canCollect ? "orange" : "green"}
            sub={
              customer.unpaidBills > 0
                ? `${customer.unpaidBills} unpaid bill${customer.unpaidBills === 1 ? "" : "s"}`
                : "all settled"
            }
          />
          <Summary
            label="Collected so far"
            value={formatCurrency(collected)}
            tone="gray"
            sub={
              customer.lastPaymentOn
                ? `last on ${formatDate(customer.lastPaymentOn)}`
                : "no payments yet"
            }
          />
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "record" | "history")}>
          <TabsList className="w-full">
            <TabsTrigger value="record" className="flex-1">
              Record Collection
            </TabsTrigger>
            <TabsTrigger value="history" className="flex-1">
              Payment History ({history.length})
            </TabsTrigger>
          </TabsList>

          {/* ── Record ─────────────────────────────────────────────────────── */}
          <TabsContent value="record" className="space-y-3 pt-2">
            {receipt && (
              <div className="rounded-lg border border-green-200 bg-green-50 p-3 space-y-2">
                <p className="flex items-center gap-2 text-sm font-semibold text-green-800">
                  <CheckCircle2 className="w-4 h-4" />
                  {formatCurrency(receipt.amount)} recorded
                </p>
                <ul className="space-y-0.5">
                  {receipt.allocations.map((a) => (
                    <li key={a.invoiceNumber} className="text-xs text-green-900 flex justify-between gap-2">
                      <span className="font-mono">{a.invoiceNumber}</span>
                      <span className="font-medium tabular-nums">{formatCurrency(a.amount)}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-green-700 border-t border-green-200 pt-1.5">
                  {receipt.remainingPending > 0.01
                    ? `${formatCurrency(receipt.remainingPending)} still pending.`
                    : "This customer is now fully settled."}
                </p>
              </div>
            )}

            {!canCollect ? (
              <div className="rounded-lg border border-gray-200 bg-gray-50 py-8 text-center">
                <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-900">Nothing outstanding</p>
                <p className="text-xs text-gray-500 mt-1 px-6">
                  A collection is settled against unpaid bills. Generate a bill first, then come back.
                </p>
              </div>
            ) : (
              <>
                <div>
                  <Label htmlFor="collect-amount">Amount collected (₹)</Label>
                  <Input
                    id="collect-amount"
                    type="number"
                    step="0.01"
                    min="0"
                    max={pending}
                    inputMode="decimal"
                    value={amount}
                    autoFocus
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="mt-1 text-lg font-semibold tabular-nums"
                  />
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <Chip onClick={() => setAmount(pending.toFixed(2))}>
                      Full {formatCurrency(pending)}
                    </Chip>
                    <Chip onClick={() => setAmount((pending / 2).toFixed(2))}>Half</Chip>
                    {[500, 1000, 2000]
                      .filter((v) => v < pending)
                      .map((v) => (
                        <Chip key={v} onClick={() => setAmount(String(v))}>
                          ₹{v}
                        </Chip>
                      ))}
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1.5">
                    Applied to the oldest unpaid bill first.
                  </p>
                </div>

                <div>
                  <Label htmlFor="collect-date">Collected on</Label>
                  <Input
                    id="collect-date"
                    type="date"
                    value={paidOn}
                    max={today()}
                    onChange={(e) => setPaidOn(e.target.value)}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="collect-note">Note (optional)</Label>
                  <Textarea
                    id="collect-note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="e.g. Cash collected at door, UPI ref 4432, part payment…"
                    maxLength={300}
                    className="mt-1"
                  />
                </div>

                {error && <ErrorNote>{error}</ErrorNote>}

                <div className="flex justify-end gap-2 pt-1">
                  <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                    Close
                  </Button>
                  <Button onClick={handleRecord} disabled={saving || !amount}>
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <IndianRupee className="w-4 h-4" />
                    )}
                    {saving ? "Saving..." : "Record Collection"}
                  </Button>
                </div>
              </>
            )}
          </TabsContent>

          {/* ── History ────────────────────────────────────────────────────── */}
          <TabsContent value="history" className="pt-2">
            {history.length === 0 ? (
              <div className="py-10 text-center">
                <Receipt className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-900">No payments yet</p>
                <p className="text-xs text-gray-500 mt-1">
                  Anything you collect will be logged here.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {history.map((entry) => (
                  <HistoryRow
                    key={entry.id}
                    entry={entry}
                    customerId={customer.id}
                    onChanged={onChanged}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

/** One logged payment — read-only until you click edit, then an inline form. */
function HistoryRow({
  entry,
  customerId,
  onChanged,
}: {
  entry: CollectionEntry;
  customerId: string;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [amount, setAmount] = useState(String(entry.amount.toFixed(2)));
  const [paidOn, setPaidOn] = useState(entry.paidOn);
  const [note, setNote] = useState(entry.note ?? "");

  function startEdit() {
    setAmount(entry.amount.toFixed(2));
    setPaidOn(entry.paidOn);
    setNote(entry.note ?? "");
    setError("");
    setEditing(true);
  }

  async function save() {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Enter an amount greater than 0.");
      return;
    }

    setBusy(true);
    setError("");
    const result = await updateCollectionAction(customerId, {
      paymentId: entry.id,
      amount: Math.round(value * 100) / 100,
      paidOn,
      note: note.trim() || undefined,
    });
    setBusy(false);

    if (!result.success) {
      setError(result.error);
      return;
    }
    setEditing(false);
    onChanged();
  }

  async function remove() {
    setBusy(true);
    setError("");
    const result = await deleteCollectionAction(customerId, entry.id);
    setBusy(false);

    if (!result.success) {
      setError(result.error);
      setConfirmDelete(false);
      return;
    }
    onChanged();
  }

  if (editing) {
    return (
      <div className="border border-amber-300 bg-amber-50/60 rounded-lg p-3 space-y-2">
        <p className="text-[11px] font-medium text-amber-800">
          Editing payment against{" "}
          <span className="font-mono">{entry.bill.invoiceNumber}</span>
        </p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor={`amt-${entry.id}`} className="text-[11px]">
              Amount (₹)
            </Label>
            <Input
              id={`amt-${entry.id}`}
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 tabular-nums"
            />
          </div>
          <div>
            <Label htmlFor={`date-${entry.id}`} className="text-[11px]">
              Collected on
            </Label>
            <Input
              id={`date-${entry.id}`}
              type="date"
              value={paidOn}
              onChange={(e) => setPaidOn(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>
        <div>
          <Label htmlFor={`note-${entry.id}`} className="text-[11px]">
            Note
          </Label>
          <Textarea
            id={`note-${entry.id}`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={300}
            placeholder="Add a note…"
            className="mt-1 min-h-[48px]"
          />
        </div>

        {error && <ErrorNote>{error}</ErrorNote>}

        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={() => setEditing(false)} disabled={busy}>
            <X className="w-3.5 h-3.5" />
            Cancel
          </Button>
          <Button size="sm" onClick={save} disabled={busy}>
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            Save
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-lg p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold text-green-700 tabular-nums">{formatCurrency(entry.amount)}</p>
          <p className="text-xs text-gray-500">{formatDate(entry.paidOn)}</p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs"
            onClick={startEdit}
            disabled={busy}
          >
            <Pencil className="w-3.5 h-3.5" />
            Edit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={() => setConfirmDelete(true)}
            disabled={busy}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2 text-[11px] text-gray-500">
        <span className="font-mono text-gray-700">{entry.bill.invoiceNumber}</span>
        <span>·</span>
        <span>{formatPeriod(entry.bill.periodStart, entry.bill.periodEnd)}</span>
        <Badge variant={entry.bill.stillDue > 0.01 ? "orange" : "success"} className="text-[10px]">
          {entry.bill.stillDue > 0.01
            ? `${formatCurrency(entry.bill.stillDue)} still due`
            : "Bill settled"}
        </Badge>
      </div>

      {entry.note && (
        <p className="mt-2 text-xs text-gray-700 bg-gray-50 border border-gray-100 rounded-md px-2 py-1.5 whitespace-pre-wrap break-words">
          {entry.note}
        </p>
      )}

      {error && (
        <div className="mt-2">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}

      {confirmDelete && (
        <div className="mt-2 flex items-center justify-between gap-2 rounded-md border border-red-200 bg-red-50 px-2.5 py-2">
          <p className="text-xs text-red-800">
            Delete this {formatCurrency(entry.amount)} payment? The bill goes back to unpaid.
          </p>
          <div className="flex gap-1.5 flex-shrink-0">
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              onClick={() => setConfirmDelete(false)}
              disabled={busy}
            >
              No
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="h-7 px-2 text-xs"
              onClick={remove}
              disabled={busy}
            >
              {busy && <Loader2 className="w-3 h-3 animate-spin" />}
              Delete
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Summary({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone: "orange" | "green" | "gray";
}) {
  const tones = {
    orange: "border-orange-200 bg-orange-50 text-orange-700",
    green: "border-green-200 bg-green-50 text-green-700",
    gray: "border-gray-200 bg-gray-50 text-gray-700",
  } as const;

  return (
    <div className={cn("rounded-lg border px-3 py-2", tones[tone])}>
      <p className="text-[11px] uppercase tracking-wide opacity-80">{label}</p>
      <p className="text-base font-bold tabular-nums">{value}</p>
      <p className="text-[11px] opacity-70 truncate">{sub}</p>
    </div>
  );
}

function Chip({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-2 py-1 rounded-md bg-gray-100 text-xs font-medium text-gray-700 hover:bg-gray-200 transition-colors"
    >
      {children}
    </button>
  );
}

function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-2.5 py-2">
      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
      <span>{children}</span>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  X,
  Loader2,
  Save,
  Undo2,
  BellRing,
  AlertTriangle,
  CheckCircle2,
  Users,
  UserCheck,
  UserX,
  IndianRupee,
  ExternalLink,
  Pencil,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import type { ManagedCustomer, PaymentStanding } from "@/lib/services/customer.service";
import type { CollectionEntry } from "@/lib/services/payment.service";
import {
  bulkUpdateCustomersAction,
  sendPaymentReminderAction,
} from "@/lib/actions/customer.actions";
import { CollectPaymentDialog } from "@/components/customers/collect-payment-dialog";

/** The fields a user can edit inline. Held as strings so inputs stay controlled. */
type Editable = {
  name: string;
  phoneNumber: string;
  address: string;
  pricePerLiter: string;
  isActive: boolean;
};

type Edits = Record<string, Partial<Editable>>;

type StatusFilter = "all" | "active" | "inactive";
type PayFilter = "all" | PaymentStanding;

const FIELD_LABELS: Record<keyof Editable, string> = {
  name: "Name",
  phoneNumber: "Phone",
  address: "Address",
  pricePerLiter: "Rate",
  isActive: "Status",
};

const STANDING_META: Record<PaymentStanding, { label: string; variant: "success" | "orange" | "destructive" | "secondary" }> = {
  PAID: { label: "Paid", variant: "success" },
  PARTIAL: { label: "Partially Paid", variant: "orange" },
  UNPAID: { label: "Unpaid", variant: "destructive" },
  NO_BILLS: { label: "No Bills", variant: "secondary" },
};

/** The saved value of a field, as a string the input can hold. */
function original(c: ManagedCustomer, field: keyof Editable): string | boolean {
  switch (field) {
    case "name":
      return c.name;
    case "phoneNumber":
      return c.phoneNumber ?? "";
    case "address":
      return c.address ?? "";
    case "pricePerLiter":
      return c.pricePerLiter === null ? "" : String(c.pricePerLiter);
    case "isActive":
      return c.isActive;
  }
}

function relativeDays(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return formatDate(new Date(iso));
}

interface Props {
  customers: ManagedCustomer[];
  /** Payment log per customer id, newest first — empty for anyone who's never paid. */
  collections: Record<string, CollectionEntry[]>;
  globalPricePerLiter: number;
}

export function CustomerManager({ customers, collections, globalPricePerLiter }: Props) {
  const router = useRouter();

  const [edits, setEdits] = useState<Edits>({});
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [payFilter, setPayFilter] = useState<PayFilter>("all");

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [rowErrors, setRowErrors] = useState<Record<string, string[]>>({});
  const [flash, setFlash] = useState("");

  const [remindingId, setRemindingId] = useState<string | null>(null);
  const [reminderMsg, setReminderMsg] = useState<{ id: string; ok: boolean; text: string } | null>(null);

  // Held as an id, not the row itself, so the open dialog picks up fresh dues
  // after a collection is saved and the page revalidates.
  const [collectId, setCollectId] = useState<string | null>(null);

  const byId = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);
  const collectCustomer = collectId ? byId.get(collectId) ?? null : null;

  // Only rows with at least one field actually differing from what's stored.
  const dirtyIds = useMemo(
    () => Object.keys(edits).filter((id) => Object.keys(edits[id]).length > 0),
    [edits]
  );
  const isDirty = dirtyIds.length > 0;

  // A half-finished edit is easy to lose by clicking a nav link — warn first.
  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(""), 4000);
    return () => clearTimeout(t);
  }, [flash]);

  /** Current on-screen value: the staged edit if there is one, else what's saved. */
  function value<K extends keyof Editable>(c: ManagedCustomer, field: K): Editable[K] {
    const staged = edits[c.id]?.[field];
    return (staged !== undefined ? staged : original(c, field)) as Editable[K];
  }

  function isChanged(c: ManagedCustomer, field: keyof Editable): boolean {
    return edits[c.id]?.[field] !== undefined;
  }

  /**
   * Stage a change. If the new value equals what's already saved, the field is
   * dropped from the edit set — so toggling something back to its original value
   * correctly leaves the row clean rather than marking it dirty forever.
   */
  function setField<K extends keyof Editable>(c: ManagedCustomer, field: K, next: Editable[K]) {
    setEdits((prev) => {
      const row = { ...(prev[c.id] ?? {}) };
      if (next === original(c, field)) {
        delete row[field];
      } else {
        row[field] = next;
      }
      const out = { ...prev };
      if (Object.keys(row).length === 0) delete out[c.id];
      else out[c.id] = row;
      return out;
    });
    // A field the user just retyped shouldn't keep showing its stale error.
    setRowErrors((prev) => {
      const key = `${c.id}.${field}`;
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function discardAll() {
    setEdits({});
    setRowErrors({});
    setSaveError("");
  }

  async function handleSave() {
    setSaving(true);
    setSaveError("");
    setRowErrors({});

    const patches = dirtyIds.map((id) => ({ id, ...edits[id] }));
    const result = await bulkUpdateCustomersAction(patches);

    setSaving(false);

    if (result.success) {
      setConfirmOpen(false);
      setEdits({});
      setFlash(
        `Saved ${result.data.updated} customer${result.data.updated === 1 ? "" : "s"}.`
      );
      router.refresh();
    } else {
      // Keep the dialog open so the user sees why nothing was saved.
      setSaveError(result.error);
      if (result.fieldErrors) setRowErrors(result.fieldErrors);
    }
  }

  async function handleRemind(c: ManagedCustomer) {
    setRemindingId(c.id);
    setReminderMsg(null);
    const result = await sendPaymentReminderAction(c.id);
    setRemindingId(null);
    setReminderMsg(
      result.success
        ? { id: c.id, ok: true, text: `Hindi reminder sent to ${c.name}.` }
        : { id: c.id, ok: false, text: result.error }
    );
    if (result.success) router.refresh();
  }

  // ── Filtering ──────────────────────────────────────────────────────────────
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers.filter((c) => {
      if (q) {
        const hit =
          c.name.toLowerCase().includes(q) ||
          (c.phoneNumber?.toLowerCase().includes(q) ?? false) ||
          (c.address?.toLowerCase().includes(q) ?? false);
        if (!hit) return false;
      }
      // Filter on the *staged* status, so a row you just deactivated doesn't
      // vanish out from under you before you've saved it. Read `edits` directly
      // rather than via value(), so this stays memoizable.
      const staged = edits[c.id]?.isActive;
      const active = staged !== undefined ? staged : c.isActive;
      if (statusFilter === "active" && !active) return false;
      if (statusFilter === "inactive" && active) return false;
      if (payFilter !== "all" && c.paymentStanding !== payFilter) return false;
      return true;
    });
  }, [customers, search, statusFilter, payFilter, edits]);

  // ── Summary tiles ──────────────────────────────────────────────────────────
  const totals = useMemo(() => {
    const activeCount = customers.filter((c) => c.isActive).length;
    return {
      total: customers.length,
      active: activeCount,
      inactive: customers.length - activeCount,
      pending: customers.reduce((s, c) => s + c.pendingAmount, 0),
      collected: customers.reduce((s, c) => s + c.totalPaid, 0),
    };
  }, [customers]);

  const dueCount = customers.filter((c) => c.pendingAmount > 0.01).length;

  return (
    <div className={cn("space-y-5", isDirty && "pb-24")}>
      {/* ── Summary ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatTile icon={Users} label="Total Customers" value={String(totals.total)} tone="blue" />
        <StatTile icon={UserCheck} label="Active" value={String(totals.active)} tone="green" />
        <StatTile icon={UserX} label="Inactive" value={String(totals.inactive)} tone="gray" />
        <StatTile
          icon={IndianRupee}
          label="Pending to Collect"
          value={formatCurrency(totals.pending)}
          sub={dueCount > 0 ? `from ${dueCount} customer${dueCount === 1 ? "" : "s"}` : "all settled"}
          tone={totals.pending > 0 ? "orange" : "green"}
        />
        <StatTile
          icon={Wallet}
          label="Collected"
          value={formatCurrency(totals.collected)}
          sub="received to date"
          tone="green"
        />
      </div>

      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl p-3 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setSearch("")}
            placeholder="Search by name, phone or address..."
            className="w-full h-10 pl-9 pr-9 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <FilterGroup
            label="Status"
            value={statusFilter}
            onChange={(v) => setStatusFilter(v as StatusFilter)}
            options={[
              { value: "all", label: "All" },
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
            ]}
          />
          <FilterGroup
            label="Payment"
            value={payFilter}
            onChange={(v) => setPayFilter(v as PayFilter)}
            options={[
              { value: "all", label: "All" },
              { value: "UNPAID", label: "Unpaid" },
              { value: "PARTIAL", label: "Partial" },
              { value: "PAID", label: "Paid" },
              { value: "NO_BILLS", label: "No Bills" },
            ]}
          />
        </div>
      </div>

      {flash && (
        <div className="flex items-center gap-2 text-sm text-green-800 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          {flash}
        </div>
      )}

      <p className="text-xs text-gray-500 px-1">
        Showing <span className="font-semibold text-gray-700">{visible.length}</span> of{" "}
        {customers.length} customers
        {isDirty && (
          <>
            {" · "}
            <span className="font-semibold text-amber-600">
              {dirtyIds.length} unsaved {dirtyIds.length === 1 ? "change" : "changes"}
            </span>
          </>
        )}
      </p>

      {/* ── Desktop table ───────────────────────────────────────────────── */}
      <div className="hidden lg:block bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-left">
                <Th className="min-w-[190px]">Customer</Th>
                <Th className="min-w-[150px]">Phone</Th>
                <Th className="min-w-[160px]">Address</Th>
                <Th>Enrolled</Th>
                <Th className="text-right">Rate ₹/L</Th>
                <Th>Payment</Th>
                <Th className="text-right">Total Amount</Th>
                <Th className="text-right">Pending</Th>
                <Th className="text-right">Total Paid</Th>
                <Th>Collection</Th>
                <Th>Reminder</Th>
                <Th className="text-center">Active</Th>
                <Th />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visible.map((c) => {
                const rowDirty = (edits[c.id] && Object.keys(edits[c.id]).length > 0) ?? false;
                const active = value(c, "isActive");
                const standing = STANDING_META[c.paymentStanding];
                const nameErr = rowErrors[`${c.id}.name`]?.[0];
                const phoneErr = rowErrors[`${c.id}.phoneNumber`]?.[0];
                const priceErr = rowErrors[`${c.id}.pricePerLiter`]?.[0];

                return (
                  <tr
                    key={c.id}
                    className={cn(
                      "transition-colors",
                      rowDirty ? "bg-amber-50/70" : "hover:bg-gray-50/70",
                      !active && !rowDirty && "bg-gray-50/40"
                    )}
                  >
                    {/* Name */}
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <span
                          className={cn(
                            "flex-shrink-0 w-8 h-8 rounded-full grid place-items-center text-xs font-bold",
                            active ? "bg-blue-100 text-blue-700" : "bg-gray-200 text-gray-500"
                          )}
                        >
                          {c.name.slice(0, 2).toUpperCase()}
                        </span>
                        <div className="min-w-0 flex-1">
                          <CellInput
                            value={value(c, "name")}
                            onChange={(v) => setField(c, "name", v)}
                            changed={isChanged(c, "name")}
                            error={nameErr}
                            className="font-medium text-gray-900"
                          />
                        </div>
                      </div>
                    </Td>

                    <Td>
                      <CellInput
                        value={value(c, "phoneNumber")}
                        onChange={(v) => setField(c, "phoneNumber", v)}
                        changed={isChanged(c, "phoneNumber")}
                        error={phoneErr}
                        placeholder="No phone"
                      />
                    </Td>

                    <Td>
                      <CellInput
                        value={value(c, "address")}
                        onChange={(v) => setField(c, "address", v)}
                        changed={isChanged(c, "address")}
                        placeholder="—"
                      />
                    </Td>

                    <Td className="text-gray-600 whitespace-nowrap">{formatDate(c.startDate)}</Td>

                    {/* Rate — blank means "inherit the global rate" */}
                    <Td>
                      <CellInput
                        value={value(c, "pricePerLiter")}
                        onChange={(v) => setField(c, "pricePerLiter", v)}
                        changed={isChanged(c, "pricePerLiter")}
                        error={priceErr}
                        placeholder={String(globalPricePerLiter)}
                        type="number"
                        className="text-right tabular-nums"
                        title={
                          value(c, "pricePerLiter") === ""
                            ? `Using global rate (₹${globalPricePerLiter}/L)`
                            : undefined
                        }
                      />
                    </Td>

                    <Td>
                      <Badge variant={standing.variant}>{standing.label}</Badge>
                      {c.unpaidBills > 0 && (
                        <p className="text-[11px] text-gray-500 mt-1 whitespace-nowrap">
                          {c.unpaidBills} unpaid bill{c.unpaidBills === 1 ? "" : "s"}
                          {c.daysOverdue !== null && c.daysOverdue > 0 && ` · ${c.daysOverdue}d old`}
                        </p>
                      )}
                    </Td>

                    {/* Everything ever billed to this customer */}
                    <Td className="text-right">
                      <span
                        className={cn(
                          "font-semibold tabular-nums",
                          c.totalBilled > 0.01 ? "text-gray-900" : "text-gray-400"
                        )}
                      >
                        {c.totalBilled > 0.01 ? formatCurrency(c.totalBilled) : "—"}
                      </span>
                    </Td>

                    <Td className="text-right">
                      <span
                        className={cn(
                          "font-semibold tabular-nums",
                          c.pendingAmount > 0.01 ? "text-orange-600" : "text-gray-400"
                        )}
                      >
                        {c.pendingAmount > 0.01 ? formatCurrency(c.pendingAmount) : "—"}
                      </span>
                    </Td>

                    {/* Total collected from this customer, across every bill */}
                    <Td className="text-right">
                      <span
                        className={cn(
                          "font-semibold tabular-nums",
                          c.totalPaid > 0.01 ? "text-green-600" : "text-gray-400"
                        )}
                      >
                        {c.totalPaid > 0.01 ? formatCurrency(c.totalPaid) : "—"}
                      </span>
                    </Td>

                    {/* Collection — record cash taken, and read back the log */}
                    <Td>
                      <div className="space-y-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800"
                          onClick={() => setCollectId(c.id)}
                          title={
                            c.pendingAmount > 0.01
                              ? `Record money collected from ${c.name}`
                              : "Nothing outstanding — open to see payment history"
                          }
                        >
                          <Wallet className="w-3 h-3" />
                          Collect
                        </Button>
                        <p className="text-[11px] text-gray-400 whitespace-nowrap">
                          {c.lastPaymentOn
                            ? `Paid ${relativeDays(c.lastPaymentOn)} · ${c.paymentsCount} entr${
                                c.paymentsCount === 1 ? "y" : "ies"
                              }`
                            : "No payments yet"}
                        </p>
                      </div>
                    </Td>

                    {/* Reminder */}
                    <Td>
                      <div className="space-y-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          disabled={
                            remindingId === c.id || c.pendingAmount <= 0.01 || !c.phoneNumber
                          }
                          title={
                            !c.phoneNumber
                              ? "No phone number on file"
                              : c.pendingAmount <= 0.01
                              ? "Nothing outstanding"
                              : "Send a WhatsApp payment reminder (in Hindi)"
                          }
                          onClick={() => handleRemind(c)}
                        >
                          {remindingId === c.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <BellRing className="w-3 h-3" />
                          )}
                          Remind
                        </Button>
                        <p className="text-[11px] text-gray-400 whitespace-nowrap">
                          {c.lastRemindedAt ? `Sent ${relativeDays(c.lastRemindedAt)}` : "Never sent"}
                        </p>
                        {reminderMsg?.id === c.id && (
                          <p
                            className={cn(
                              "text-[11px] max-w-[160px]",
                              reminderMsg.ok ? "text-green-600" : "text-red-600"
                            )}
                          >
                            {reminderMsg.text}
                          </p>
                        )}
                      </div>
                    </Td>

                    <Td className="text-center">
                      <Switch
                        checked={active}
                        onCheckedChange={(v) => setField(c, "isActive", v)}
                        aria-label={`${active ? "Deactivate" : "Activate"} ${c.name}`}
                      />
                    </Td>

                    <Td>
                      <Link
                        href={`/customers/${c.id}`}
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline whitespace-nowrap"
                      >
                        View <ExternalLink className="w-3 h-3" />
                      </Link>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {visible.length === 0 && <EmptyState />}
      </div>

      {/* ── Mobile cards ────────────────────────────────────────────────── */}
      <div className="lg:hidden space-y-3">
        {visible.map((c) => {
          const rowDirty = (edits[c.id] && Object.keys(edits[c.id]).length > 0) ?? false;
          const active = value(c, "isActive");
          const standing = STANDING_META[c.paymentStanding];

          return (
            <div
              key={c.id}
              className={cn(
                "bg-white border rounded-xl p-4 space-y-3",
                rowDirty ? "border-amber-300 bg-amber-50/60" : "border-gray-200"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span
                    className={cn(
                      "flex-shrink-0 w-9 h-9 rounded-full grid place-items-center text-xs font-bold",
                      active ? "bg-blue-100 text-blue-700" : "bg-gray-200 text-gray-500"
                    )}
                  >
                    {c.name.slice(0, 2).toUpperCase()}
                  </span>
                  <CellInput
                    value={value(c, "name")}
                    onChange={(v) => setField(c, "name", v)}
                    changed={isChanged(c, "name")}
                    error={rowErrors[`${c.id}.name`]?.[0]}
                    className="font-semibold text-gray-900"
                  />
                </div>
                <Switch
                  checked={active}
                  onCheckedChange={(v) => setField(c, "isActive", v)}
                  aria-label={`${active ? "Deactivate" : "Activate"} ${c.name}`}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Field label="Phone">
                  <CellInput
                    value={value(c, "phoneNumber")}
                    onChange={(v) => setField(c, "phoneNumber", v)}
                    changed={isChanged(c, "phoneNumber")}
                    error={rowErrors[`${c.id}.phoneNumber`]?.[0]}
                    placeholder="No phone"
                  />
                </Field>
                <Field label={`Rate ₹/L (global ${globalPricePerLiter})`}>
                  <CellInput
                    value={value(c, "pricePerLiter")}
                    onChange={(v) => setField(c, "pricePerLiter", v)}
                    changed={isChanged(c, "pricePerLiter")}
                    error={rowErrors[`${c.id}.pricePerLiter`]?.[0]}
                    placeholder={String(globalPricePerLiter)}
                    type="number"
                  />
                </Field>
                <Field label="Address" className="col-span-2">
                  <CellInput
                    value={value(c, "address")}
                    onChange={(v) => setField(c, "address", v)}
                    changed={isChanged(c, "address")}
                    placeholder="—"
                  />
                </Field>
              </div>

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-100 text-xs">
                <span className="text-gray-500">Enrolled {formatDate(c.startDate)}</span>
                <Badge variant={standing.variant}>{standing.label}</Badge>
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="flex gap-4">
                  <Money
                    label="Total Amount"
                    value={c.totalBilled}
                    className={c.totalBilled > 0.01 ? "text-gray-900" : "text-gray-400"}
                  />
                  <Money
                    label="Pending"
                    value={c.pendingAmount}
                    className={c.pendingAmount > 0.01 ? "text-orange-600" : "text-gray-400"}
                    sub={
                      c.unpaidBills > 0
                        ? `${c.unpaidBills} unpaid${
                            c.daysOverdue !== null && c.daysOverdue > 0 ? ` · ${c.daysOverdue}d old` : ""
                          }`
                        : undefined
                    }
                  />
                  <Money
                    label="Total Paid"
                    value={c.totalPaid}
                    className={c.totalPaid > 0.01 ? "text-green-600" : "text-gray-400"}
                  />
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800"
                      onClick={() => setCollectId(c.id)}
                    >
                      <Wallet className="w-3 h-3" />
                      Collect
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      disabled={remindingId === c.id || c.pendingAmount <= 0.01 || !c.phoneNumber}
                      onClick={() => handleRemind(c)}
                    >
                      {remindingId === c.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <BellRing className="w-3 h-3" />
                      )}
                      Remind
                    </Button>
                    <Link href={`/customers/${c.id}`}>
                      <Button size="sm" variant="ghost" className="h-8 text-xs">
                        View
                      </Button>
                    </Link>
                  </div>
                  <p className="text-[11px] text-gray-400">
                    {c.lastPaymentOn ? `Paid ${relativeDays(c.lastPaymentOn)}` : "No payments yet"}
                  </p>
                  <p className="text-[11px] text-gray-400">
                    {c.lastRemindedAt ? `Reminded ${relativeDays(c.lastRemindedAt)}` : "Never reminded"}
                  </p>
                  {reminderMsg?.id === c.id && (
                    <p className={cn("text-[11px] text-right", reminderMsg.ok ? "text-green-600" : "text-red-600")}>
                      {reminderMsg.text}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {visible.length === 0 && (
          <div className="bg-white border border-gray-200 rounded-xl">
            <EmptyState />
          </div>
        )}
      </div>

      {/* ── Sticky unsaved-changes bar ──────────────────────────────────── */}
      {isDirty && (
        <div className="fixed bottom-0 left-0 right-0 lg:left-64 z-40 border-t border-amber-200 bg-amber-50/95 backdrop-blur px-4 py-3 mb-[68px] lg:mb-0">
          <div className="flex items-center justify-between gap-3 max-w-6xl mx-auto">
            <div className="flex items-center gap-2 min-w-0">
              <Pencil className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <p className="text-sm text-amber-900 truncate">
                <span className="font-semibold">
                  {dirtyIds.length} customer{dirtyIds.length === 1 ? "" : "s"}
                </span>{" "}
                edited — not saved yet
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button variant="outline" size="sm" onClick={discardAll} disabled={saving}>
                <Undo2 className="w-4 h-4" />
                Discard
              </Button>
              <Button size="sm" onClick={() => setConfirmOpen(true)} disabled={saving}>
                <Save className="w-4 h-4" />
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Collect payment / payment history ───────────────────────────── */}
      {collectCustomer && (
        <CollectPaymentDialog
          key={collectCustomer.id}
          customer={collectCustomer}
          history={collections[collectCustomer.id] ?? []}
          open
          onOpenChange={(o) => !o && setCollectId(null)}
          onChanged={() => router.refresh()}
        />
      )}

      {/* ── Save confirmation ───────────────────────────────────────────── */}
      <Dialog open={confirmOpen} onOpenChange={(o) => !saving && setConfirmOpen(o)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Save these changes?</DialogTitle>
            <DialogDescription>
              You&apos;re about to update {dirtyIds.length} customer
              {dirtyIds.length === 1 ? "" : "s"}. Review before saving.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {dirtyIds.map((id) => {
              const c = byId.get(id);
              if (!c) return null;
              const row = edits[id];
              return (
                <div key={id} className="border border-gray-200 rounded-lg p-3">
                  <p className="text-sm font-semibold text-gray-900 mb-2">{c.name}</p>
                  <ul className="space-y-1">
                    {(Object.keys(row) as (keyof Editable)[]).map((field) => {
                      const before = original(c, field);
                      const after = row[field];
                      return (
                        <li key={field} className="text-xs flex items-start gap-2">
                          <span className="text-gray-500 w-16 flex-shrink-0">
                            {FIELD_LABELS[field]}
                          </span>
                          <span className="text-red-600 line-through break-all">
                            {renderVal(field, before)}
                          </span>
                          <span className="text-gray-400">→</span>
                          <span className="text-green-700 font-medium break-all">
                            {renderVal(field, after)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>

          {saveError && (
            <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">{saveError}</p>
                {Object.keys(rowErrors).length > 0 && (
                  <p className="text-xs mt-1">
                    Nothing was saved. Close this dialog to fix the highlighted fields.
                  </p>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? "Saving..." : "Yes, Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Small building blocks ────────────────────────────────────────────────────

function renderVal(field: keyof Editable, v: string | boolean | undefined): string {
  if (field === "isActive") return v ? "Active" : "Inactive";
  if (v === "" || v === undefined) return field === "pricePerLiter" ? "Global rate" : "(empty)";
  return String(v);
}

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        "px-3 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wide",
        className
      )}
    >
      {children}
    </th>
  );
}

function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={cn("px-3 py-2.5 align-top", className)}>{children}</td>;
}

/** One money figure on a mobile card. Zero reads as an em-dash, never "₹0.00". */
function Money({
  label,
  value,
  sub,
  className,
}: {
  label: string;
  value: number;
  sub?: string;
  className?: string;
}) {
  return (
    <div>
      <p className="text-[11px] text-gray-400">{label}</p>
      <p className={cn("font-bold tabular-nums", className)}>
        {value > 0.01 ? formatCurrency(value) : "—"}
      </p>
      {sub && <p className="text-[11px] text-gray-500">{sub}</p>}
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-[11px] text-gray-400 mb-0.5">{label}</p>
      {children}
    </div>
  );
}

/**
 * An input that looks like plain text until you interact with it, so a dense
 * table doesn't read as a wall of form controls. Turns amber when edited.
 */
function CellInput({
  value,
  onChange,
  changed,
  error,
  placeholder,
  type = "text",
  className,
  title,
}: {
  value: string;
  onChange: (v: string) => void;
  changed?: boolean;
  error?: string;
  placeholder?: string;
  type?: string;
  className?: string;
  title?: string;
}) {
  return (
    <div>
      <input
        type={type}
        step={type === "number" ? "0.01" : undefined}
        min={type === "number" ? "0" : undefined}
        value={value}
        title={title}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "w-full px-2 py-1 text-sm rounded-md border bg-transparent transition-colors",
          "hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white",
          changed
            ? "border-amber-400 bg-amber-100/60 font-medium"
            : "border-transparent",
          error && "border-red-400 bg-red-50",
          className
        )}
      />
      {error && <p className="text-[11px] text-red-600 mt-0.5 px-2">{error}</p>}
    </div>
  );
}

function FilterGroup({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</span>
      <div className="flex flex-wrap gap-1">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              "px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
              value === o.value
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  tone: "blue" | "green" | "gray" | "orange";
}) {
  const tones = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    gray: "bg-gray-100 text-gray-500",
    orange: "bg-orange-50 text-orange-600",
  } as const;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3.5 flex items-center gap-3">
      <div className={cn("w-9 h-9 rounded-lg grid place-items-center flex-shrink-0", tones[tone])}>
        <Icon className="w-4.5 h-4.5" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-gray-500 uppercase tracking-wide truncate">{label}</p>
        <p className="text-lg font-bold text-gray-900 truncate">{value}</p>
        {sub && <p className="text-[11px] text-gray-400 truncate">{sub}</p>}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="py-16 text-center">
      <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
      <p className="text-sm font-medium text-gray-900">No customers match your filters</p>
      <p className="text-xs text-gray-500 mt-1">Try changing the search or filter options.</p>
    </div>
  );
}

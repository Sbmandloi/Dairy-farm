"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createManualBillAction } from "@/lib/actions/billing.actions";
import {
  Search, X, ChevronRight, ChevronLeft, Printer, Save,
  CheckCircle, Loader2, Phone, MapPin, IndianRupee, FileDown,
  User, Milk, Hash, Calendar,
} from "lucide-react";
import { SendWhatsAppButton } from "./send-whatsapp-button";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface QuickBillCustomer {
  id: string;
  name: string;
  phoneNumber: string;
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function avatarColor(name: string) {
  const colors = [
    "bg-blue-500","bg-emerald-500","bg-violet-500",
    "bg-orange-500","bg-rose-500","bg-teal-500",
    "bg-indigo-500","bg-amber-500",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", minimumFractionDigits: 2,
  }).format(n);
}

function formatDate(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function today() {
  return new Date().toISOString().split("T")[0];
}

// ─── Saved bill type ─────────────────────────────────────────────────────────

interface SavedBill {
  id: string;
  invoiceNumber: string;
  totalLiters: number;
  pricePerLiter: number;
  totalAmount: number;
  periodStart: string;
  periodEnd: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string | null;
}

// ─── Main Wizard ─────────────────────────────────────────────────────────────

export function QuickBillWizard({ customers, settings }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<QuickBillCustomer | null>(null);

  // Form values
  const [periodStart, setPeriodStart] = useState(today());
  const [periodEnd, setPeriodEnd] = useState(today());
  const [liters, setLiters] = useState("");
  const [pricePerLiter, setPricePerLiter] = useState("");
  const [notes, setNotes] = useState("");

  // Save state
  const [saving, setSaving] = useState(false);
  const [savedBill, setSavedBill] = useState<SavedBill | null>(null);
  const [saveError, setSaveError] = useState("");

  const invoiceRef = useRef<HTMLDivElement>(null);

  // Computed
  const totalAmount =
    parseFloat(liters || "0") > 0 && parseFloat(pricePerLiter || "0") > 0
      ? parseFloat(liters) * parseFloat(pricePerLiter)
      : 0;

  const filteredCustomers = searchQuery
    ? customers.filter(
        (c) =>
          c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.phoneNumber.includes(searchQuery)
      )
    : customers;

  // ── Handlers ────────────────────────────────────────────────────────────────

  function selectCustomer(c: QuickBillCustomer) {
    setSelectedCustomer(c);
    const price = c.pricePerLiter ?? settings.globalPricePerLiter;
    setPricePerLiter(String(price));
    setStep(2);
  }

  function goToPreview() {
    if (!selectedCustomer || !liters || !pricePerLiter || parseFloat(liters) <= 0) return;
    setStep(3);
  }

  async function handleSave() {
    if (!selectedCustomer) return;
    setSaving(true);
    setSaveError("");
    const result = await createManualBillAction({
      customerId: selectedCustomer.id,
      periodStart,
      periodEnd,
      totalLiters: parseFloat(liters),
      pricePerLiter: parseFloat(pricePerLiter),
      notes,
    });
    setSaving(false);
    if (result.success) {
      setSavedBill({
        id: result.data.id,
        invoiceNumber: result.data.invoiceNumber,
        totalLiters: result.data.totalLiters,
        pricePerLiter: result.data.pricePerLiter,
        totalAmount: result.data.totalAmount,
        periodStart: result.data.periodStart,
        periodEnd: result.data.periodEnd,
        customerName: result.data.customerName,
        customerPhone: result.data.customerPhone,
        customerAddress: result.data.customerAddress,
      });
    } else {
      setSaveError(result.error ?? "Failed to save");
    }
  }

  function handlePrint() {
    if (!selectedCustomer) return;
    const w = window.open("", "_blank", "width=860,height=750");
    if (!w) return;

    const sameDay = periodStart === periodEnd;
    const pLabel = sameDay
      ? formatDate(periodStart)
      : `${formatDate(periodStart)} — ${formatDate(periodEnd)}`;
    const invNum = savedBill?.invoiceNumber ?? "PREVIEW";
    const isPreview = invNum === "PREVIEW";

    w.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>Invoice ${invNum}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#1a1a1a;background:#fff;padding:40px}
    @media print{body{padding:20px} .no-print{display:none}}

    /* ── Header ── */
    .header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:20px;margin-bottom:28px;border-bottom:3px solid #2563eb}
    .logo-row{display:flex;align-items:center;gap:10px;margin-bottom:6px}
    .logo-box{width:36px;height:36px;background:#2563eb;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:18px;font-weight:900;flex-shrink:0}
    .farm-name{font-size:22px;font-weight:900;color:#1d4ed8}
    .farm-sub{font-size:11px;color:#6b7280;margin-top:2px}
    .inv-meta{text-align:right}
    .inv-label{font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:.1em;font-weight:700}
    .inv-number{font-size:20px;font-weight:900;color:${isPreview ? "#9ca3af" : "#111827"};margin:4px 0}
    .inv-date{font-size:11px;color:#6b7280}

    /* ── Section label ── */
    .sec-label{font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.15em;margin-bottom:10px}

    /* ── Bill-to box ── */
    .bill-to{margin-bottom:28px}
    .bill-to-box{background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:16px}
    .cust-name{font-size:15px;font-weight:700;color:#111827;margin-bottom:6px}
    .cust-detail{font-size:12px;color:#6b7280;margin-top:4px;display:flex;align-items:center;gap:6px}

    /* ── Table ── */
    .summary{margin-bottom:24px}
    table{width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden}
    thead tr{background:#2563eb}
    th{padding:12px 16px;font-size:12px;font-weight:700;color:#fff;text-align:left}
    th.r{text-align:right}
    td{padding:12px 16px;font-size:13px;border-bottom:1px solid #f3f4f6;color:#374151}
    td.r{text-align:right;font-weight:600}
    tr.alt{background:#f9fafb}
    .liters{color:#1d4ed8;font-weight:700}
    tfoot tr{background:#eff6ff}
    tfoot td{padding:16px;border-bottom:none}
    tfoot .tot-label{font-size:15px;font-weight:900;color:#1f2937}
    tfoot .tot-amount{text-align:right;font-size:22px;font-weight:900;color:#1d4ed8}

    /* ── Amount words ── */
    .words{background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:10px 16px;margin-bottom:28px;font-size:13px;color:#92400e}

    /* ── Footer ── */
    .footer{border-top:1px solid #e5e7eb;padding-top:16px;text-align:center}
    .footer p{font-size:12px;color:#9ca3af;margin-bottom:3px}
    .footer .f-farm{font-weight:600;color:#6b7280;font-size:13px}

    /* ── Watermark ── */
    .watermark{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-25deg);font-size:90px;font-weight:900;color:rgba(0,0,0,.05);pointer-events:none;white-space:nowrap;z-index:999}

    /* ── Print button ── */
    .print-btn{display:block;margin:0 auto 32px;padding:10px 28px;background:#2563eb;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer}
    .print-btn:hover{background:#1d4ed8}
  </style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">🖨️ Print / Save as PDF</button>

  <!-- HEADER -->
  <div class="header">
    <div>
      <div class="logo-row">
        <div class="logo-box">🐄</div>
        <span class="farm-name">${settings.farmName}</span>
      </div>
      ${settings.farmAddress ? `<div class="farm-sub">📍 ${settings.farmAddress}</div>` : ""}
      ${settings.farmPhone ? `<div class="farm-sub">📞 ${settings.farmPhone}</div>` : ""}
    </div>
    <div class="inv-meta">
      <div class="inv-label">Invoice</div>
      <div class="inv-number">${invNum}</div>
      <div class="inv-date">${sameDay ? "Date" : "Period"}: ${pLabel}</div>
    </div>
  </div>

  <!-- BILL TO -->
  <div class="bill-to">
    <div class="sec-label">Bill To</div>
    <div class="bill-to-box">
      <div class="cust-name">${selectedCustomer.name}</div>
      <div class="cust-detail">📞 ${selectedCustomer.phoneNumber}</div>
      ${selectedCustomer.address ? `<div class="cust-detail">📍 ${selectedCustomer.address}</div>` : ""}
    </div>
  </div>

  <!-- SUMMARY TABLE -->
  <div class="summary">
    <div class="sec-label">Billing Summary</div>
    <table>
      <thead>
        <tr><th>Description</th><th class="r">Details</th></tr>
      </thead>
      <tbody>
        <tr class="alt">
          <td>Billing Period</td>
          <td class="r">${pLabel}</td>
        </tr>
        <tr>
          <td>Total Milk Quantity</td>
          <td class="r liters">${parseFloat(liters).toFixed(1)} L</td>
        </tr>
        <tr class="alt">
          <td>Rate per Liter</td>
          <td class="r">${formatCurrency(parseFloat(pricePerLiter || "0"))}</td>
        </tr>
        ${notes ? `<tr><td>Notes</td><td class="r" style="font-style:italic;color:#6b7280">${notes}</td></tr>` : ""}
      </tbody>
      <tfoot>
        <tr>
          <td class="tot-label">TOTAL AMOUNT</td>
          <td class="tot-amount">${formatCurrency(totalAmount)}</td>
        </tr>
      </tfoot>
    </table>
  </div>

  <!-- AMOUNT IN WORDS -->
  <div class="words"><strong>Amount: </strong>${formatCurrency(totalAmount)}</div>

  <!-- FOOTER -->
  <div class="footer">
    <p>Thank you for your business!</p>
    <p class="f-farm">${settings.farmName}</p>
    ${settings.farmPhone ? `<p>${settings.farmPhone}</p>` : ""}
  </div>

  ${isPreview ? '<div class="watermark">PREVIEW</div>' : ""}
</body>
</html>`);
    w.document.close();
  }

  function resetWizard() {
    setStep(1);
    setSelectedCustomer(null);
    setSearchQuery("");
    setSearchInput("");
    setLiters("");
    setPricePerLiter("");
    setNotes("");
    setPeriodStart(today());
    setPeriodEnd(today());
    setSavedBill(null);
    setSaveError("");
  }

  // ── Step progress indicator ──────────────────────────────────────────────────

  const steps = [
    { n: 1, label: "Select Customer" },
    { n: 2, label: "Bill Details" },
    { n: 3, label: "Preview & Save" },
  ];

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* Progress steps */}
      <div className="flex items-center gap-0">
        {steps.map((s, i) => (
          <div key={s.n} className="flex items-center flex-1">
            <div className={`flex items-center gap-2 ${i < steps.length - 1 ? "flex-1" : ""}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 border-2 transition-all ${
                step === s.n
                  ? "bg-blue-600 border-blue-600 text-white"
                  : step > s.n
                  ? "bg-green-500 border-green-500 text-white"
                  : "bg-white border-gray-300 text-gray-400"
              }`}>
                {step > s.n ? <CheckCircle className="w-4 h-4" /> : s.n}
              </div>
              <span className={`text-xs font-medium hidden sm:block ${step === s.n ? "text-blue-600" : step > s.n ? "text-green-600" : "text-gray-400"}`}>
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 ${step > s.n ? "bg-green-400" : "bg-gray-200"}`} />
            )}
          </div>
        ))}
      </div>

      {/* ─── STEP 1: Customer selection ─────────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 pb-1 border-b border-gray-100">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
              <User className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900">Select a Customer</h2>
              <p className="text-xs text-gray-400">Search or pick from your customer list</p>
            </div>
          </div>

          {/* Search */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") setSearchQuery(searchInput.trim());
                  if (e.key === "Escape") { setSearchInput(""); setSearchQuery(""); }
                }}
                placeholder="Search by name or phone…"
                className="pl-9 pr-8 h-9 w-full rounded-md border border-gray-200 bg-white text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
              />
              {searchInput && (
                <button type="button" onClick={() => { setSearchInput(""); setSearchQuery(""); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <Button size="sm" onClick={() => setSearchQuery(searchInput.trim())}>
              <Search className="w-4 h-4" /> Search
            </Button>
          </div>

          {searchQuery && (
            <p className="text-xs text-gray-500">
              {filteredCustomers.length} result{filteredCustomers.length !== 1 ? "s" : ""} for &ldquo;{searchQuery}&rdquo;
            </p>
          )}

          {/* Customer grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[420px] overflow-y-auto pr-1">
            {filteredCustomers.map((c) => (
              <button
                key={c.id}
                onClick={() => selectCustomer(c)}
                className="text-left bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-md transition-all group"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white ${avatarColor(c.name)}`}>
                    {getInitials(c.name)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 group-hover:text-blue-600 truncate">{c.name}</p>
                    <p className="text-xs text-gray-400 flex items-center gap-1">
                      <Phone className="w-3 h-3" /> {c.phoneNumber}
                    </p>
                  </div>
                </div>
                {c.address && (
                  <p className="text-xs text-gray-400 flex items-center gap-1 mb-2">
                    <MapPin className="w-3 h-3 shrink-0" />
                    <span className="truncate">{c.address}</span>
                  </p>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <IndianRupee className="w-3 h-3" />
                    {c.pricePerLiter != null
                      ? `${formatCurrency(c.pricePerLiter)}/L (custom)`
                      : `${formatCurrency(settings.globalPricePerLiter)}/L (global)`}
                  </span>
                  <span className="text-xs text-blue-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                    Select <ChevronRight className="w-3 h-3" />
                  </span>
                </div>
              </button>
            ))}

            {filteredCustomers.length === 0 && (
              <div className="col-span-full text-center py-12 text-gray-400">
                <p>No customers found{searchQuery ? ` for "${searchQuery}"` : ""}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── STEP 2: Bill Details ────────────────────────────────────────── */}
      {step === 2 && selectedCustomer && (
        <div className="space-y-5">
          <div className="flex items-center gap-3 pb-1 border-b border-gray-100">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
              <Milk className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900">Bill Details</h2>
              <p className="text-xs text-gray-400">Enter quantity and pricing for the bill</p>
            </div>
          </div>

          {/* Selected customer card */}
          <div className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-xl p-3">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white ${avatarColor(selectedCustomer.name)}`}>
                {getInitials(selectedCustomer.name)}
              </div>
              <div>
                <p className="font-semibold text-gray-900">{selectedCustomer.name}</p>
                <p className="text-xs text-gray-500">{selectedCustomer.phoneNumber}</p>
              </div>
            </div>
            <button
              onClick={() => setStep(1)}
              className="text-xs text-blue-600 hover:underline flex items-center gap-1"
            >
              <ChevronLeft className="w-3 h-3" /> Change
            </button>
          </div>

          {/* Form */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            {/* Period date range */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" /> Period Start
                </label>
                <Input
                  type="date"
                  value={periodStart}
                  onChange={(e) => {
                    setPeriodStart(e.target.value);
                    if (e.target.value > periodEnd) setPeriodEnd(e.target.value);
                  }}
                  max={today()}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" /> Period End
                </label>
                <Input
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  min={periodStart}
                  max={today()}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-1 gap-4">
              {/* Price per Liter */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide flex items-center gap-1.5">
                  <IndianRupee className="w-3.5 h-3.5" /> Price per Liter (₹)
                </label>
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  value={pricePerLiter}
                  onChange={(e) => setPricePerLiter(e.target.value)}
                  placeholder={String(settings.globalPricePerLiter)}
                />
              </div>
            </div>

            {/* Total Liters */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide flex items-center gap-1.5">
                <Milk className="w-3.5 h-3.5" /> Total Milk Quantity (Liters)
              </label>
              <Input
                type="number"
                min="0"
                step="0.5"
                value={liters}
                onChange={(e) => setLiters(e.target.value)}
                placeholder="Enter total liters…"
                className="text-lg"
              />
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add a note to this bill (e.g. period, reason)…"
                rows={2}
                className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 resize-none"
              />
            </div>

            {/* Live calculation */}
            {totalAmount > 0 && (
              <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-100 rounded-xl p-4">
                <p className="text-xs text-blue-600 font-semibold uppercase tracking-wide mb-2">Live Calculation</p>
                <div className="flex items-center justify-between text-sm text-gray-700 mb-1">
                  <span>{liters} L  ×  {formatCurrency(parseFloat(pricePerLiter || "0"))}/L</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-600">Total Amount</span>
                  <span className="text-2xl font-extrabold text-blue-700">{formatCurrency(totalAmount)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Next button */}
          <div className="flex gap-3 justify-between">
            <Button variant="outline" onClick={() => setStep(1)}>
              <ChevronLeft className="w-4 h-4" /> Back
            </Button>
            <Button
              onClick={goToPreview}
              disabled={!liters || !pricePerLiter || parseFloat(liters) <= 0 || parseFloat(pricePerLiter) <= 0}
            >
              Preview Bill <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ─── STEP 3: Preview & Save ──────────────────────────────────────── */}
      {step === 3 && selectedCustomer && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3 pb-1 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
                <Hash className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-gray-900">Invoice Preview</h2>
                <p className="text-xs text-gray-400">Review, then save or print</p>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {!savedBill && (
                <Button variant="outline" size="sm" onClick={() => setStep(2)}>
                  <ChevronLeft className="w-4 h-4" /> Edit
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="w-4 h-4" /> Print
              </Button>
              {!savedBill ? (
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving ? "Saving…" : "Save Bill"}
                </Button>
              ) : (
                <>
                  <SendWhatsAppButton billId={savedBill.id} />
                  <a href={`/api/billing/${savedBill.id}/pdf`} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline">
                      <FileDown className="w-4 h-4" /> Download PDF
                    </Button>
                  </a>
                  <Button size="sm" onClick={resetWizard}>
                    <CheckCircle className="w-4 h-4" /> New Bill
                  </Button>
                </>
              )}
            </div>
          </div>

          {saveError && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {saveError}
            </div>
          )}

          {savedBill && (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <CheckCircle className="w-4 h-4 shrink-0" />
              Bill saved as <strong>{savedBill.invoiceNumber}</strong>. You can now download the PDF.
            </div>
          )}

          {/* Invoice HTML Preview */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <InvoicePreview
              ref={invoiceRef}
              farmName={settings.farmName}
              farmAddress={settings.farmAddress}
              farmPhone={settings.farmPhone}
              invoiceNumber={savedBill?.invoiceNumber ?? "PREVIEW"}
              periodStart={periodStart}
              periodEnd={periodEnd}
              customerName={selectedCustomer.name}
              customerPhone={selectedCustomer.phoneNumber}
              customerAddress={selectedCustomer.address}
              totalLiters={parseFloat(liters)}
              pricePerLiter={parseFloat(pricePerLiter)}
              totalAmount={totalAmount}
              notes={notes}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Invoice Preview HTML ─────────────────────────────────────────────────────

interface InvoicePreviewProps {
  ref: React.RefObject<HTMLDivElement | null>;
  farmName: string;
  farmAddress: string | null;
  farmPhone: string | null;
  invoiceNumber: string;
  periodStart: string;
  periodEnd: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string | null;
  totalLiters: number;
  pricePerLiter: number;
  totalAmount: number;
  notes: string;
}

function InvoicePreview({
  ref,
  farmName, farmAddress, farmPhone,
  invoiceNumber, periodStart, periodEnd,
  customerName, customerPhone, customerAddress,
  totalLiters, pricePerLiter, totalAmount, notes,
}: InvoicePreviewProps) {
  const sameDay = periodStart === periodEnd;
  const periodLabel = sameDay
    ? formatDate(periodStart)
    : `${formatDate(periodStart)} — ${formatDate(periodEnd)}`;

  return (
    <div ref={ref} className="p-8 font-sans text-gray-900" style={{ fontFamily: "Arial, sans-serif" }}>

      {/* Header */}
      <div className="flex justify-between items-start pb-5 mb-6 border-b-2 border-blue-600">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <Milk className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-2xl font-extrabold text-blue-700">{farmName}</h1>
          </div>
          {farmAddress && <p className="text-xs text-gray-500">{farmAddress}</p>}
          {farmPhone && <p className="text-xs text-gray-500">Phone: {farmPhone}</p>}
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Invoice</p>
          <p className={`text-xl font-extrabold ${invoiceNumber === "PREVIEW" ? "text-gray-400" : "text-gray-900"}`}>
            {invoiceNumber}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {sameDay ? `Date: ${periodLabel}` : `Period: ${periodLabel}`}
          </p>
        </div>
      </div>

      {/* Bill To */}
      <div className="mb-6">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Bill To</p>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <p className="text-base font-bold text-gray-900">{customerName}</p>
          <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
            <Phone className="w-3.5 h-3.5" /> {customerPhone}
          </p>
          {customerAddress && (
            <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
              <MapPin className="w-3.5 h-3.5" /> {customerAddress}
            </p>
          )}
        </div>
      </div>

      {/* Summary table */}
      <div className="mb-6">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Billing Summary</p>
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-blue-600 text-white">
                <th className="text-left px-4 py-3 font-semibold">Description</th>
                <th className="text-right px-4 py-3 font-semibold">Details</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-100 bg-gray-50">
                <td className="px-4 py-3 text-gray-600">Billing Period</td>
                <td className="px-4 py-3 text-right font-semibold text-gray-700">{periodLabel}</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="px-4 py-3 text-gray-600">Total Milk Quantity</td>
                <td className="px-4 py-3 text-right font-semibold text-blue-700">{totalLiters.toFixed(1)} L</td>
              </tr>
              <tr className="border-b border-gray-100 bg-gray-50">
                <td className="px-4 py-3 text-gray-600">Rate per Liter</td>
                <td className="px-4 py-3 text-right font-semibold">{formatCurrency(pricePerLiter)}</td>
              </tr>
              {notes && (
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-3 text-gray-600">Notes</td>
                  <td className="px-4 py-3 text-right text-gray-500 italic">{notes}</td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="bg-blue-50">
                <td className="px-4 py-4 font-extrabold text-gray-800 text-base">TOTAL AMOUNT</td>
                <td className="px-4 py-4 text-right font-extrabold text-2xl text-blue-700">
                  {formatCurrency(totalAmount)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Amount in words */}
      <div className="bg-amber-50 border border-amber-100 rounded-lg px-4 py-2 mb-6 text-sm text-amber-800">
        <span className="font-semibold">Amount: </span>{formatCurrency(totalAmount)}
      </div>

      {/* Footer */}
      <div className="pt-4 border-t border-gray-200 text-center">
        <p className="text-xs text-gray-400">Thank you for your business!</p>
        <p className="text-xs text-gray-500 font-medium mt-0.5">{farmName}</p>
        {farmPhone && <p className="text-xs text-gray-400">{farmPhone}</p>}
      </div>

      {invoiceNumber === "PREVIEW" && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.07] overflow-hidden">
          <span className="text-8xl font-black text-gray-900 rotate-[-25deg] select-none">PREVIEW</span>
        </div>
      )}
    </div>
  );
}

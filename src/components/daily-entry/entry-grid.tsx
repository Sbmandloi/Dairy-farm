"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchBar } from "@/components/ui/search-bar";
import { cn } from "@/lib/utils";
import { saveDailyEntriesAction, copyPreviousDayAction } from "@/lib/actions/daily-entry.actions";
import { Loader2, Save, ClipboardPaste, CheckCircle2, X, AlertCircle } from "lucide-react";

// Plain serializable types (no Prisma Decimal / Date objects)
export interface SerializedCustomer {
  id: string;
  name: string;
  phoneNumber: string | null;
  address: string | null;
  pricePerLiter: number | null;
  isActive: boolean;
}

export interface SerializedEntry {
  id: string;
  customerId: string;
  morningLiters: number | null;
  eveningLiters: number | null;
  totalLiters: number;
  notes: string | null;
}

export interface CustomerEntryRow {
  customer: SerializedCustomer;
  entry: SerializedEntry | null;
}

interface EntryGridProps {
  date: string;
  rows: CustomerEntryRow[];
  entryMode: string;
}

interface RowState {
  morning: string;
  evening: string;
  total: string;
}

type Unit = "L" | "ml";

const UNIT_PREFS_KEY = "dairy_customer_units";

const AVATAR_COLORS = [
  "bg-blue-500", "bg-emerald-500", "bg-violet-500",
  "bg-orange-500", "bg-rose-500", "bg-teal-500",
  "bg-indigo-500", "bg-amber-500",
];
function avatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
}

function loadUnitPrefs(): Record<string, Unit> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(UNIT_PREFS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
function saveUnitPrefs(prefs: Record<string, Unit>) {
  try {
    localStorage.setItem(UNIT_PREFS_KEY, JSON.stringify(prefs));
  } catch {}
}
function litersToDisplay(liters: string, unit: Unit): string {
  if (!liters) return "";
  const n = parseFloat(liters);
  if (isNaN(n)) return "";
  return unit === "ml" ? String(Math.round(n * 1000)) : liters;
}
function displayToLiters(display: string, unit: Unit): string {
  if (!display) return "";
  const n = parseFloat(display);
  if (isNaN(n)) return "";
  return unit === "ml" ? String(n / 1000) : display;
}

export function EntryGrid({ date, rows, entryMode }: EntryGridProps) {
  const router = useRouter();
  const isSplit = entryMode === "SPLIT";

  const initState = (): Record<string, RowState> => {
    const s: Record<string, RowState> = {};
    for (const { customer, entry } of rows) {
      s[customer.id] = {
        morning: entry?.morningLiters != null ? String(entry.morningLiters) : "",
        evening: entry?.eveningLiters != null ? String(entry.eveningLiters) : "",
        total: entry != null ? String(entry.totalLiters) : "",
      };
    }
    return s;
  };

  const initUnits = (): Record<string, Unit> => {
    const saved = loadUnitPrefs();
    const u: Record<string, Unit> = {};
    for (const { customer } of rows) u[customer.id] = saved[customer.id] ?? "L";
    return u;
  };

  const [dataL, setDataL] = useState<Record<string, RowState>>(initState);
  const [rowUnits, setRowUnits] = useState<Record<string, Unit>>(initUnits);
  const [saving, setSaving] = useState(false);
  const [pasting, setPasting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Which customers had a saved entry when the page loaded — needed so that
  // CLEARING a previously-saved entry is sent to the server (as a delete)
  // instead of being silently dropped.
  const originallyHadEntry = useMemo(() => {
    const s = new Set<string>();
    for (const { customer, entry } of rows) if (entry) s.add(customer.id);
    return s;
  }, [rows]);

  useEffect(() => {
    saveUnitPrefs(rowUnits);
  }, [rowUnits]);

  const toggleRowUnit = useCallback((customerId: string) => {
    setRowUnits((prev) => {
      const next = { ...prev, [customerId]: prev[customerId] === "L" ? ("ml" as Unit) : ("L" as Unit) };
      saveUnitPrefs(next);
      return next;
    });
  }, []);

  function getDisplayRow(customerId: string): RowState {
    const row = dataL[customerId];
    const unit = rowUnits[customerId] ?? "L";
    if (unit === "L") return row;
    return {
      morning: litersToDisplay(row.morning, "ml"),
      evening: litersToDisplay(row.evening, "ml"),
      total: litersToDisplay(row.total, "ml"),
    };
  }

  const markDirty = () => {
    setSaved(false);
    setDirty(true);
    setInfo("");
  };

  const updateRow = useCallback(
    (customerId: string, field: keyof RowState, displayValue: string) => {
      markDirty();
      setRowUnits((units) => {
        const unit = units[customerId] ?? "L";
        const literValue = displayToLiters(displayValue, unit);
        setDataL((prev) => {
          const row = { ...prev[customerId], [field]: literValue };
          if (isSplit) {
            const m = parseFloat(row.morning) || 0;
            const e = parseFloat(row.evening) || 0;
            row.total = m + e > 0 ? String(m + e) : "";
          }
          return { ...prev, [customerId]: row };
        });
        return units;
      });
    },
    [isSplit]
  );

  const quickAdd = useCallback(
    (customerId: string, field: keyof RowState, amountInUnit: number) => {
      markDirty();
      setRowUnits((units) => {
        const unit = units[customerId] ?? "L";
        const amountL = unit === "ml" ? amountInUnit / 1000 : amountInUnit;
        setDataL((prev) => {
          const row = { ...prev[customerId] };
          const cur = parseFloat(row[field]) || 0;
          row[field] = String(cur + amountL);
          if (isSplit) {
            const m = parseFloat(row.morning) || 0;
            const e = parseFloat(row.evening) || 0;
            row.total = String(m + e);
          }
          return { ...prev, [customerId]: row };
        });
        return units;
      });
    },
    [isSplit]
  );

  const clearRow = useCallback((customerId: string) => {
    markDirty();
    setDataL((prev) => ({ ...prev, [customerId]: { morning: "", evening: "", total: "" } }));
  }, []);

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const entries = rows
        .map(({ customer }) => {
          const row = dataL[customer.id];
          const m = parseFloat(row.morning) || 0;
          const e = parseFloat(row.evening) || 0;
          const total = isSplit ? m + e : parseFloat(row.total) || 0;
          const hasValue =
            total > 0 || row.morning !== "" || row.evening !== "" || row.total !== "";

          // Send a row if it has a value now, OR it had a saved entry before
          // (so a cleared entry is deleted rather than left stale in the DB).
          if (!hasValue && !originallyHadEntry.has(customer.id)) return null;

          return {
            customerId: customer.id,
            morningLiters: isSplit ? m || undefined : undefined,
            eveningLiters: isSplit ? e || undefined : undefined,
            totalLiters: total,
          };
        })
        .filter(Boolean) as {
          customerId: string;
          morningLiters?: number;
          eveningLiters?: number;
          totalLiters: number;
        }[];

      const result = await saveDailyEntriesAction(date, entries);
      if (result.success) {
        setSaved(true);
        setDirty(false);
        setTimeout(() => setSaved(false), 3000);
        // Refresh the server-rendered summary cards to reflect what was saved.
        router.refresh();
      } else {
        setError(result.error);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handlePastePrevious() {
    setPasting(true);
    setError("");
    setInfo("");
    try {
      const result = await copyPreviousDayAction(date);
      if (result.success) {
        const newData: Record<string, RowState> = { ...dataL };
        let count = 0;
        for (const entry of result.data) {
          if (!(entry.customerId in newData)) continue;
          newData[entry.customerId] = {
            morning: entry.morningLiters != null ? String(entry.morningLiters) : "",
            evening: entry.eveningLiters != null ? String(entry.eveningLiters) : "",
            total: String(entry.totalLiters),
          };
          count++;
        }
        setDataL(newData);
        markDirty();
        setInfo(
          count > 0
            ? `Pasted ${count} entr${count === 1 ? "y" : "ies"} from the previous day. Review and Save.`
            : "The previous day had no entries to paste."
        );
      } else {
        setError(result.error);
      }
    } finally {
      setPasting(false);
    }
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const totalLiters = useMemo(
    () =>
      Object.values(dataL).reduce((sum, row) => {
        const t = row.total !== "" ? parseFloat(row.total) || 0 : 0;
        return sum + t;
      }, 0),
    [dataL]
  );

  const enteredCount = useMemo(
    () => Object.values(dataL).filter((r) => (parseFloat(r.total) || 0) > 0).length,
    [dataL]
  );

  const progressPct = rows.length > 0 ? Math.round((enteredCount / rows.length) * 100) : 0;
  const mlCount = Object.values(rowUnits).filter((u) => u === "ml").length;

  const visibleRows = searchQuery
    ? rows.filter(
        (r) =>
          r.customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (r.customer.phoneNumber?.includes(searchQuery) ?? false)
      )
    : rows;

  return (
    <div className={cn("space-y-4", dirty && "pb-24")}>
      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl p-3 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <SearchBar
            placeholder="Filter customer by name or phone…"
            onSearch={setSearchQuery}
            className="flex-1"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handlePastePrevious}
            disabled={pasting || saving}
            title="Fill this day's grid from the previous day's entries"
            className="flex-shrink-0"
          >
            {pasting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardPaste className="w-4 h-4" />}
            Paste Previous Day
          </Button>
        </div>

        {/* Progress */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-gray-600">
              <span className="font-semibold text-gray-900">{enteredCount}</span> of {rows.length} entered
              {mlCount > 0 && (
                <span className="ml-2 text-purple-600">· {mlCount} in ml</span>
              )}
            </span>
            <span className="text-gray-600">
              Total <span className="font-bold text-blue-600">{totalLiters.toFixed(2)} L</span>
            </span>
          </div>
          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {searchQuery && (
        <p className="text-xs text-gray-500">
          Showing {visibleRows.length} of {rows.length} customers
        </p>
      )}

      {info && (
        <div className="flex items-center gap-2 text-sm text-blue-800 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
          <ClipboardPaste className="w-4 h-4 flex-shrink-0" />
          {info}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* ── Entry rows ──────────────────────────────────────────────────── */}
      <div className="space-y-2">
        {visibleRows.map(({ customer }) => {
          const unit = rowUnits[customer.id] ?? "L";
          const isML = unit === "ml";
          const displayRow = getDisplayRow(customer.id);
          const literRow = dataL[customer.id];
          const totalL = isSplit
            ? (parseFloat(literRow.morning) || 0) + (parseFloat(literRow.evening) || 0)
            : parseFloat(literRow.total) || 0;
          const hasValue = totalL > 0;

          const quickAmounts = isML ? [500, 1000, 1500, 2000] : [0.5, 1, 1.5, 2];
          const inputStep = isML ? "50" : "0.5";

          return (
            <div
              key={customer.id}
              className={cn(
                "bg-white border rounded-xl p-3 transition-colors",
                "flex flex-col sm:flex-row sm:items-center gap-3",
                hasValue ? "border-l-4 border-l-green-400 border-y-gray-200 border-r-gray-200" : "border-gray-200"
              )}
            >
              {/* Customer */}
              <div className="flex items-center gap-2.5 sm:w-52 flex-shrink-0">
                <div className={cn("w-9 h-9 rounded-full grid place-items-center text-xs font-bold text-white flex-shrink-0", avatarColor(customer.name))}>
                  {initials(customer.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm text-gray-900 leading-tight truncate">{customer.name}</p>
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs text-gray-400 truncate">{customer.phoneNumber || "—"}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => toggleRowUnit(customer.id)}
                  title={`Entering in ${unit}. Tap to switch to ${isML ? "L" : "ml"}`}
                  className={cn(
                    "flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all",
                    isML
                      ? "bg-purple-100 border-purple-300 text-purple-700 hover:bg-purple-200"
                      : "bg-blue-50 border-blue-200 text-blue-500 hover:bg-blue-100"
                  )}
                >
                  {unit}
                </button>
              </div>

              {/* Inputs */}
              <div className={cn("flex-1 grid gap-3", isSplit ? "grid-cols-2" : "grid-cols-1")}>
                {isSplit && (
                  <EntryField
                    label="Morning"
                    value={displayRow.morning}
                    step={inputStep}
                    isML={isML}
                    quickAmounts={quickAmounts}
                    onChange={(v) => updateRow(customer.id, "morning", v)}
                    onQuick={(a) => quickAdd(customer.id, "morning", a)}
                  />
                )}
                <EntryField
                  label={isSplit ? "Evening" : "Quantity"}
                  value={isSplit ? displayRow.evening : displayRow.total}
                  step={inputStep}
                  isML={isML}
                  quickAmounts={quickAmounts}
                  onChange={(v) => updateRow(customer.id, isSplit ? "evening" : "total", v)}
                  onQuick={(a) => quickAdd(customer.id, isSplit ? "evening" : "total", a)}
                />
              </div>

              {/* Total */}
              <div className="flex sm:flex-col items-center justify-between sm:justify-center sm:w-24 flex-shrink-0 sm:text-center border-t sm:border-t-0 sm:border-l border-gray-100 pt-2 sm:pt-0 sm:pl-3">
                {hasValue ? (
                  <>
                    <div className="flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500 sm:hidden" />
                      <p className={cn("text-sm font-bold leading-tight", isML ? "text-purple-600" : "text-blue-600")}>
                        {isML ? `${Math.round(totalL * 1000)} ml` : `${totalL.toFixed(2)} L`}
                      </p>
                    </div>
                    <button
                      onClick={() => clearRow(customer.id)}
                      className="inline-flex items-center gap-0.5 text-[10px] text-red-400 hover:text-red-600 transition-colors sm:mt-1"
                    >
                      <X className="w-3 h-3" /> Clear
                    </button>
                  </>
                ) : (
                  <p className="text-gray-300 text-sm font-bold">—</p>
                )}
              </div>
            </div>
          );
        })}

        {rows.length === 0 && (
          <div className="text-center py-12 text-gray-400 bg-white border border-dashed border-gray-200 rounded-xl">
            No active customers. Add customers first.
          </div>
        )}
        {rows.length > 0 && visibleRows.length === 0 && (
          <div className="text-center py-12 text-gray-400 bg-white border border-dashed border-gray-200 rounded-xl">
            No customers match &ldquo;{searchQuery}&rdquo;
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-2 text-xs text-gray-400 flex-wrap">
        <span>Tap the unit badge</span>
        <span className="px-1.5 py-0.5 rounded-full border bg-blue-50 border-blue-200 text-blue-500 font-bold">L</span>
        <span>/</span>
        <span className="px-1.5 py-0.5 rounded-full border bg-purple-100 border-purple-300 text-purple-700 font-bold">ml</span>
        <span>on a customer to change their entry unit. Preference is saved automatically.</span>
      </div>

      {/* ── Sticky save bar ─────────────────────────────────────────────── */}
      {(dirty || saving || saved) && (
        <div className="fixed bottom-0 left-0 right-0 lg:left-64 z-40 border-t border-gray-200 bg-white/95 backdrop-blur px-4 py-3 mb-[68px] lg:mb-0 shadow-[0_-2px_8px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between gap-3 max-w-5xl mx-auto">
            <div className="text-sm min-w-0">
              {saved ? (
                <span className="flex items-center gap-1.5 text-green-600 font-medium">
                  <CheckCircle2 className="w-4 h-4" /> Saved
                </span>
              ) : (
                <span className="text-gray-600 truncate">
                  <span className="font-semibold text-gray-900">{enteredCount}</span> entered ·{" "}
                  <span className="font-bold text-blue-600">{totalLiters.toFixed(2)} L</span>
                  <span className="hidden sm:inline text-amber-600"> · unsaved changes</span>
                </span>
              )}
            </div>
            <Button size="sm" onClick={handleSave} disabled={saving} className="flex-shrink-0 min-w-28">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? "Saving…" : "Save All"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function EntryField({
  label,
  value,
  step,
  isML,
  quickAmounts,
  onChange,
  onQuick,
}: {
  label: string;
  value: string;
  step: string;
  isML: boolean;
  quickAmounts: number[];
  onChange: (v: string) => void;
  onQuick: (amount: number) => void;
}) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">{label}</p>
      <Input
        type="number"
        inputMode="decimal"
        min="0"
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
        className={cn("text-center h-10 text-base", isML && "border-purple-200 focus-visible:ring-purple-400")}
      />
      <div className="flex gap-1 flex-wrap justify-center">
        {quickAmounts.map((amt) => (
          <button
            key={amt}
            type="button"
            onClick={() => onQuick(amt)}
            className={cn(
              "text-[10px] px-1.5 py-0.5 rounded font-medium transition-colors",
              isML ? "bg-purple-50 text-purple-600 hover:bg-purple-100" : "bg-blue-50 text-blue-600 hover:bg-blue-100"
            )}
          >
            +{amt}
          </button>
        ))}
      </div>
    </div>
  );
}

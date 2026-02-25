"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveDailyEntriesAction, copyPreviousDayAction } from "@/lib/actions/daily-entry.actions";
import { Loader2, Save, Copy, CheckCircle } from "lucide-react";

// Plain serializable types (no Prisma Decimal / Date objects)
export interface SerializedCustomer {
  id: string;
  name: string;
  phoneNumber: string;
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

const UNIT_PREFS_KEY = "dairy_customer_units"; // localStorage key

// Read saved unit preferences from localStorage
function loadUnitPrefs(): Record<string, Unit> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(UNIT_PREFS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

// Save unit preferences to localStorage
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
  const isSplit = entryMode === "SPLIT";

  // Internal row state always stored in LITERS (values are already plain numbers)
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

  // Per-customer unit — initialised from localStorage so preference is remembered
  const initUnits = (): Record<string, Unit> => {
    const saved = loadUnitPrefs();
    const u: Record<string, Unit> = {};
    for (const { customer } of rows) {
      u[customer.id] = saved[customer.id] ?? "L";
    }
    return u;
  };

  const [dataL, setDataL] = useState<Record<string, RowState>>(initState);
  const [rowUnits, setRowUnits] = useState<Record<string, Unit>>(initUnits);
  const [saving, setSaving] = useState(false);
  const [copying, setCopying] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // Whenever rowUnits changes, persist to localStorage
  useEffect(() => {
    saveUnitPrefs(rowUnits);
  }, [rowUnits]);

  // Toggle unit for a single customer and persist
  const toggleRowUnit = useCallback((customerId: string) => {
    setRowUnits((prev) => {
      const next = { ...prev, [customerId]: prev[customerId] === "L" ? ("ml" as Unit) : ("L" as Unit) };
      saveUnitPrefs(next);
      return next;
    });
  }, []);

  // Get display values for a row in its selected unit
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

  const updateRow = useCallback(
    (customerId: string, field: keyof RowState, displayValue: string) => {
      setSaved(false);
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
      setSaved(false);
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
    setDataL((prev) => ({
      ...prev,
      [customerId]: { morning: "", evening: "", total: "" },
    }));
  }, []);

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const entries = rows
        .map(({ customer }) => {
          const row = dataL[customer.id]; // always in liters
          const total = parseFloat(row.total) || 0;
          if (total === 0 && !row.morning && !row.evening) return null;
          return {
            customerId: customer.id,
            morningLiters: isSplit ? (parseFloat(row.morning) || undefined) : undefined,
            eveningLiters: isSplit ? (parseFloat(row.evening) || undefined) : undefined,
            totalLiters: isSplit
              ? (parseFloat(row.morning) || 0) + (parseFloat(row.evening) || 0)
              : parseFloat(row.total) || 0,
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
        setTimeout(() => setSaved(false), 3000);
      } else {
        setError(result.error);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleCopyPrevious() {
    setCopying(true);
    try {
      const result = await copyPreviousDayAction(date);
      if (result.success) {
        const newData: Record<string, RowState> = { ...dataL };
        for (const entry of result.data) {
          newData[entry.customerId] = {
            morning: entry.morningLiters != null ? String(entry.morningLiters) : "",
            evening: entry.eveningLiters != null ? String(entry.eveningLiters) : "",
            total: String(entry.totalLiters),
          };
        }
        setDataL(newData);
      }
    } finally {
      setCopying(false);
    }
  }

  const totalLiters = Object.values(dataL).reduce(
    (sum, row) => sum + (parseFloat(row.total) || 0),
    0
  );

  const mlCount = Object.values(rowUnits).filter((u) => u === "ml").length;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="text-sm text-gray-600">
            Total:{" "}
            <span className="font-bold text-blue-600">{totalLiters.toFixed(2)} L</span>
            <span className="text-gray-400 ml-1 text-xs">
              ({Math.round(totalLiters * 1000)} ml)
            </span>
          </div>
          {mlCount > 0 && (
            <span className="text-xs bg-purple-50 text-purple-600 border border-purple-200 rounded-full px-2 py-0.5">
              {mlCount} customer{mlCount > 1 ? "s" : ""} in ml mode
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleCopyPrevious} disabled={copying}>
            {copying ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
            Copy Previous Day
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : saved ? (
              <CheckCircle className="w-4 h-4 text-green-500" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saved ? "Saved!" : "Save All"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {/* Entry table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {/* Header */}
        <div
          className={`grid ${
            isSplit ? "grid-cols-[1.4fr_1fr_1fr_auto]" : "grid-cols-[1.4fr_1fr_auto]"
          } gap-0 bg-gray-50 border-b border-gray-200`}
        >
          <div className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">
            Customer
          </div>
          {isSplit ? (
            <>
              <div className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide text-center">
                Morning
              </div>
              <div className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide text-center">
                Evening
              </div>
            </>
          ) : (
            <div className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide text-center">
              Quantity
            </div>
          )}
          <div className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide text-center">
            Total
          </div>
        </div>

        {/* Rows */}
        {rows.map(({ customer }) => {
          const unit = rowUnits[customer.id] ?? "L";
          const isML = unit === "ml";
          const displayRow = getDisplayRow(customer.id);
          const literRow = dataL[customer.id];

          const totalL = isSplit
            ? (parseFloat(literRow.morning) || 0) + (parseFloat(literRow.evening) || 0)
            : parseFloat(literRow.total) || 0;

          // Show primary total in selected unit, secondary in the other
          const primaryTotal = isML
            ? `${Math.round(totalL * 1000)} ml`
            : `${totalL.toFixed(2)} L`;
          const secondaryTotal = isML
            ? `${totalL.toFixed(2)} L`
            : `${Math.round(totalL * 1000)} ml`;

          const quickAmounts = isML ? [500, 1000, 1500, 2000] : [0.5, 1, 1.5, 2];
          const inputStep = isML ? "50" : "0.5";

          return (
            <div
              key={customer.id}
              className={`grid ${
                isSplit ? "grid-cols-[1.4fr_1fr_1fr_auto]" : "grid-cols-[1.4fr_1fr_auto]"
              } gap-0 border-b border-gray-100 last:border-0 transition-colors ${
                isML ? "hover:bg-purple-50/40" : "hover:bg-gray-50/70"
              }`}
            >
              {/* Customer name + per-row unit toggle */}
              <div className="px-4 py-3 flex flex-col justify-center">
                <p className="font-medium text-sm text-gray-900 leading-tight">
                  {customer.name}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-xs text-gray-400 truncate flex-1 min-w-0">
                    {customer.phoneNumber}
                  </p>
                  {/*
                    Unit toggle badge — tap to switch between L and ml for THIS customer.
                    The preference is remembered in localStorage across sessions.
                    This day's entry for this customer will be entered and displayed in the selected unit.
                  */}
                  <button
                    type="button"
                    onClick={() => toggleRowUnit(customer.id)}
                    title={`Currently entering in ${unit}. Tap to switch to ${isML ? "L" : "ml"}`}
                    className={`flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all ${
                      isML
                        ? "bg-purple-100 border-purple-300 text-purple-700 hover:bg-purple-200"
                        : "bg-blue-50 border-blue-200 text-blue-500 hover:bg-blue-100"
                    }`}
                  >
                    {unit}
                  </button>
                </div>
              </div>

              {/* Morning (split mode) */}
              {isSplit && (
                <div className="px-2 py-2">
                  <div className="space-y-1.5">
                    <Input
                      type="number"
                      min="0"
                      step={inputStep}
                      value={displayRow.morning}
                      onChange={(e) => updateRow(customer.id, "morning", e.target.value)}
                      placeholder="0"
                      className={`text-center h-10 text-base ${
                        isML ? "border-purple-200 focus-visible:ring-purple-400" : ""
                      }`}
                    />
                    <div className="flex gap-1 flex-wrap justify-center">
                      {quickAmounts.map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => quickAdd(customer.id, "morning", amt)}
                          className={`text-[10px] px-1.5 py-0.5 rounded font-medium transition-colors ${
                            isML
                              ? "bg-purple-50 text-purple-600 hover:bg-purple-100"
                              : "bg-blue-50 text-blue-600 hover:bg-blue-100"
                          }`}
                        >
                          +{amt}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Evening / Single entry */}
              <div className="px-2 py-2">
                <div className="space-y-1.5">
                  <Input
                    type="number"
                    min="0"
                    step={inputStep}
                    value={isSplit ? displayRow.evening : displayRow.total}
                    onChange={(e) =>
                      updateRow(customer.id, isSplit ? "evening" : "total", e.target.value)
                    }
                    placeholder="0"
                    className={`text-center h-10 text-base ${
                      isML ? "border-purple-200 focus-visible:ring-purple-400" : ""
                    }`}
                  />
                  <div className="flex gap-1 flex-wrap justify-center">
                    {quickAmounts.map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() =>
                          quickAdd(customer.id, isSplit ? "evening" : "total", amt)
                        }
                        className={`text-[10px] px-1.5 py-0.5 rounded font-medium transition-colors ${
                          isML
                            ? "bg-purple-50 text-purple-600 hover:bg-purple-100"
                            : "bg-blue-50 text-blue-600 hover:bg-blue-100"
                        }`}
                      >
                        +{amt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Total column */}
              <div className="px-3 py-3 flex flex-col items-center justify-center min-w-[82px]">
                {totalL > 0 ? (
                  <>
                    <p
                      className={`text-sm font-bold leading-tight ${
                        isML ? "text-purple-600" : "text-blue-600"
                      }`}
                    >
                      {primaryTotal}
                    </p>
                    {/* Secondary unit shown small below */}
                    <p className="text-[10px] text-gray-400 mt-0.5">{secondaryTotal}</p>
                    <button
                      onClick={() => clearRow(customer.id)}
                      className="text-[10px] text-red-400 hover:text-red-600 mt-1 transition-colors"
                    >
                      Clear
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
          <div className="text-center py-12 text-gray-400">
            No active customers. Add customers first.
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-2 text-xs text-gray-400 flex-wrap">
        <span>Tap the unit badge</span>
        <span className="px-1.5 py-0.5 rounded-full border bg-blue-50 border-blue-200 text-blue-500 font-bold">L</span>
        <span>/</span>
        <span className="px-1.5 py-0.5 rounded-full border bg-purple-100 border-purple-300 text-purple-700 font-bold">ml</span>
        <span>on each customer to change their entry unit for today. Preference is saved automatically.</span>
      </div>
    </div>
  );
}

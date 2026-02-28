"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SearchBar } from "@/components/ui/search-bar";
import { saveMonthlyEntriesAction } from "@/lib/actions/daily-entry.actions";
import {
  ChevronLeft,
  ChevronRight,
  Save,
  Loader2,
  CheckCircle,
  Droplets,
  Users,
  TrendingUp,
  CalendarDays,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface MonthlyCustomer {
  id: string;
  name: string;
  phoneNumber: string;
}

export interface MonthlyEntryRow {
  id: string;
  customerId: string;
  date: string; // "YYYY-MM-DD"
  morningLiters: number | null;
  eveningLiters: number | null;
  totalLiters: number;
}

interface Props {
  year: number;
  month: number;
  daysInMonth: number;
  customers: MonthlyCustomer[];
  entries: MonthlyEntryRow[];
  entryMode: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

type CellKey = string; // `${customerId}-${day}`

interface CellValue {
  totalLiters: number;
  morningLiters: number | null;
  eveningLiters: number | null;
}

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function dateStr(year: number, month: number, day: number) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function getDayMeta(year: number, month: number, day: number) {
  const d = new Date(year, month - 1, day);
  const today = new Date();
  const isToday =
    today.getFullYear() === year &&
    today.getMonth() + 1 === month &&
    today.getDate() === day;
  const isSunday = d.getDay() === 0;
  const isSaturday = d.getDay() === 6;
  const weekday = d.toLocaleDateString("en-IN", { weekday: "short" });
  return { isToday, isSunday, isSaturday, weekday };
}

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

// ─── Component ───────────────────────────────────────────────────────────────

export function MonthlyEntryGrid({
  year,
  month,
  daysInMonth,
  customers,
  entries,
  entryMode,
}: Props) {
  const router = useRouter();
  const isSplit = entryMode === "SPLIT";
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Build initial data from server entries
  const buildInitialData = (): Record<CellKey, CellValue> => {
    const map: Record<CellKey, CellValue> = {};
    for (const e of entries) {
      const day = parseInt(e.date.split("-")[2]);
      map[`${e.customerId}-${day}`] = {
        totalLiters: e.totalLiters,
        morningLiters: e.morningLiters,
        eveningLiters: e.eveningLiters,
      };
    }
    return map;
  };

  const [data, setData] = useState<Record<CellKey, CellValue>>(buildInitialData);
  const [dirty, setDirty] = useState<Set<CellKey>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  // Which cell is open for editing
  const [editingKey, setEditingKey] = useState<string | null>(null);
  // Temp edit values
  const [editTotal, setEditTotal] = useState("");
  const [editMorning, setEditMorning] = useState("");
  const [editEvening, setEditEvening] = useState("");

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // ─── Cell edit helpers ────────────────────────────────────────────────────

  function openCell(key: string) {
    if (editingKey === key) return;
    // commit previous if any
    if (editingKey) commitCell(editingKey);
    const val = data[key];
    setEditingKey(key);
    if (isSplit) {
      setEditMorning(val?.morningLiters != null ? String(val.morningLiters) : "");
      setEditEvening(val?.eveningLiters != null ? String(val.eveningLiters) : "");
    } else {
      setEditTotal(val?.totalLiters ? String(val.totalLiters) : "");
    }
  }

  const commitCell = useCallback(
    (key: string) => {
      if (editingKey !== key) return;
      setEditingKey(null);

      let totalL: number;
      let morningL: number | null = null;
      let eveningL: number | null = null;

      if (isSplit) {
        morningL = editMorning !== "" ? parseFloat(editMorning) || 0 : null;
        eveningL = editEvening !== "" ? parseFloat(editEvening) || 0 : null;
        totalL = (morningL ?? 0) + (eveningL ?? 0);
      } else {
        totalL = editTotal !== "" ? parseFloat(editTotal) || 0 : 0;
      }

      const prev = data[key];
      const unchanged =
        prev &&
        prev.totalLiters === totalL &&
        prev.morningLiters === morningL &&
        prev.eveningLiters === eveningL;
      const nothingBefore = !prev && totalL === 0;

      if (!unchanged && !nothingBefore) {
        setData((d) => ({ ...d, [key]: { totalLiters: totalL, morningL, eveningL } as unknown as CellValue }));
        setData((d) => ({
          ...d,
          [key]: { totalLiters: totalL, morningLiters: morningL, eveningLiters: eveningL },
        }));
        setDirty((d) => new Set([...d, key]));
        setSaved(false);
      }
    },
    [editingKey, isSplit, editTotal, editMorning, editEvening, data]
  );

  function cancelCell() {
    setEditingKey(null);
  }

  // ─── Save ─────────────────────────────────────────────────────────────────

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const changes = Array.from(dirty).map((key) => {
        const [customerId, dayStr] = key.split("-");
        const val = data[key];
        return {
          date: dateStr(year, month, parseInt(dayStr)),
          customerId,
          totalLiters: val?.totalLiters ?? 0,
          morningLiters: val?.morningLiters ?? null,
          eveningLiters: val?.eveningLiters ?? null,
        };
      });
      const result = await saveMonthlyEntriesAction(changes);
      if (result.success) {
        setDirty(new Set());
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
        router.refresh();
      } else {
        setError(result.error ?? "Failed to save");
      }
    } finally {
      setSaving(false);
    }
  }

  // ─── Navigation ──────────────────────────────────────────────────────────

  function navigate(delta: number) {
    let m = month + delta;
    let y = year;
    if (m > 12) { m = 1; y++; }
    if (m < 1) { m = 12; y--; }
    router.push(`/monthly-entry?year=${y}&month=${m}`);
  }

  // ─── Aggregates ──────────────────────────────────────────────────────────

  const rowTotal = useCallback(
    (customerId: string) =>
      days.reduce((s, d) => s + (data[`${customerId}-${d}`]?.totalLiters ?? 0), 0),
    [data, days]
  );

  const colTotal = useCallback(
    (day: number) =>
      customers.reduce((s, c) => s + (data[`${c.id}-${day}`]?.totalLiters ?? 0), 0),
    [data, customers]
  );

  const grandTotal = customers.reduce((s, c) => s + rowTotal(c.id), 0);
  const daysWithEntries = days.filter((d) => colTotal(d) > 0).length;

  // Filter customers by search
  const visibleCustomers = searchQuery
    ? customers.filter((c) =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phoneNumber.includes(searchQuery)
      )
    : customers;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* ── Month navigator ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="min-w-[170px] text-center">
            <p className="font-extrabold text-gray-900 text-lg leading-tight">
              {MONTH_NAMES[month - 1]} {year}
            </p>
            <p className="text-xs text-gray-400">
              {daysInMonth} days &middot; {customers.length} customers
            </p>
          </div>
          <Button variant="outline" size="icon" onClick={() => navigate(1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {dirty.size > 0 && (
            <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
              {dirty.size} unsaved change{dirty.size !== 1 ? "s" : ""}
            </span>
          )}
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || dirty.size === 0}
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : saved ? (
              <CheckCircle className="w-4 h-4 text-green-500" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saved ? "Saved!" : dirty.size > 0 ? `Save (${dirty.size})` : "Save"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {/* ── Customer search ── */}
      <div className="flex items-center gap-4 flex-wrap">
        <SearchBar
          placeholder="Filter customers by name or phone…"
          onSearch={setSearchQuery}
          className="max-w-sm"
        />
        {searchQuery && (
          <p className="text-xs text-gray-500">
            Showing {visibleCustomers.length} of {customers.length} customers
          </p>
        )}
      </div>

      {/* ── Summary strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Milk", value: `${grandTotal.toFixed(1)} L`, icon: <Droplets className="w-4 h-4 text-blue-500" />, color: "bg-blue-50 border-blue-100" },
          { label: "Customers", value: customers.length.toString(), icon: <Users className="w-4 h-4 text-violet-500" />, color: "bg-violet-50 border-violet-100" },
          { label: "Active Days", value: daysWithEntries.toString(), icon: <CalendarDays className="w-4 h-4 text-teal-500" />, color: "bg-teal-50 border-teal-100" },
          { label: "Avg / Day", value: daysWithEntries ? `${(grandTotal / daysWithEntries).toFixed(1)} L` : "—", icon: <TrendingUp className="w-4 h-4 text-green-500" />, color: "bg-green-50 border-green-100" },
        ].map((s) => (
          <div key={s.label} className={`border rounded-xl p-3 flex items-center gap-3 ${s.color}`}>
            <div className="flex-shrink-0">{s.icon}</div>
            <div>
              <p className="text-xs text-gray-500">{s.label}</p>
              <p className="font-bold text-gray-900">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Grid ── */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto" onClick={() => editingKey && cancelCell()}>
          <table
            className="border-collapse text-sm"
            style={{ minWidth: `${140 + daysInMonth * 52 + 76}px` }}
          >
            {/* Column group for sticky sizing */}
            <colgroup>
              <col style={{ width: 140, minWidth: 140 }} />
              {days.map((d) => <col key={d} style={{ width: 52, minWidth: 44 }} />)}
              <col style={{ width: 76, minWidth: 76 }} />
            </colgroup>

            <thead>
              <tr className="bg-gray-50 border-b-2 border-gray-200">
                {/* Customer header */}
                <th className="sticky left-0 z-20 bg-gray-50 px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200">
                  Customer
                </th>

                {/* Day headers */}
                {days.map((day) => {
                  const { isToday, isSunday, weekday } = getDayMeta(year, month, day);
                  return (
                    <th
                      key={day}
                      className={`px-0.5 py-2 text-center ${
                        isToday
                          ? "bg-blue-100 text-blue-700"
                          : isSunday
                          ? "bg-red-50 text-red-400"
                          : "text-gray-500"
                      }`}
                    >
                      <div className="text-xs font-bold leading-none">{day}</div>
                      <div className="text-[9px] font-normal opacity-60 mt-0.5">{weekday}</div>
                    </th>
                  );
                })}

                {/* Total header */}
                <th className="sticky right-0 z-20 bg-gray-50 px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide border-l border-gray-200">
                  Total
                </th>
              </tr>
            </thead>

            <tbody>
              {visibleCustomers.map((customer, idx) => {
                const cTotal = rowTotal(customer.id);
                const rowBg = idx % 2 === 0 ? "bg-white" : "bg-gray-50/40";

                return (
                  <tr key={customer.id} className={`border-b border-gray-100 last:border-0 ${rowBg}`}>
                    {/* Customer name — sticky */}
                    <td className={`sticky left-0 z-10 px-3 py-2.5 border-r border-gray-200 ${rowBg}`}>
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white ${avatarColor(customer.name)}`}
                        >
                          {getInitials(customer.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-gray-900 truncate max-w-[90px]">
                            {customer.name}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Day cells */}
                    {days.map((day) => {
                      const key = `${customer.id}-${day}`;
                      const val = data[key];
                      const isEditing = editingKey === key;
                      const isDirty = dirty.has(key);
                      const hasValue = val && val.totalLiters > 0;
                      const { isToday, isSunday } = getDayMeta(year, month, day);

                      return (
                        <td
                          key={day}
                          className={`px-0.5 py-0.5 align-middle ${
                            isToday ? "bg-blue-50/60" : isSunday ? "bg-red-50/20" : ""
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            openCell(key);
                          }}
                        >
                          {isEditing ? (
                            /* ── Edit mode ── */
                            <div
                              className="flex flex-col gap-0.5 items-center"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {isSplit ? (
                                <>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.5"
                                    value={editMorning}
                                    autoFocus
                                    placeholder="M"
                                    onChange={(e) => {
                                      setEditMorning(e.target.value);
                                      const m = parseFloat(e.target.value) || 0;
                                      const ev = parseFloat(editEvening) || 0;
                                      setEditTotal(String(m + ev));
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" || e.key === "Tab") {
                                        e.preventDefault();
                                        commitCell(key);
                                      }
                                      if (e.key === "Escape") cancelCell();
                                    }}
                                    className="w-11 text-center text-[11px] border border-blue-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                                  />
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.5"
                                    value={editEvening}
                                    placeholder="E"
                                    onChange={(e) => {
                                      setEditEvening(e.target.value);
                                      const m = parseFloat(editMorning) || 0;
                                      const ev = parseFloat(e.target.value) || 0;
                                      setEditTotal(String(m + ev));
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" || e.key === "Tab") {
                                        e.preventDefault();
                                        commitCell(key);
                                      }
                                      if (e.key === "Escape") cancelCell();
                                    }}
                                    onBlur={() => commitCell(key)}
                                    className="w-11 text-center text-[11px] border border-orange-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-orange-400 bg-white"
                                  />
                                </>
                              ) : (
                                <input
                                  type="number"
                                  min="0"
                                  step="0.5"
                                  value={editTotal}
                                  autoFocus
                                  placeholder="0"
                                  onChange={(e) => setEditTotal(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === "Tab") {
                                      e.preventDefault();
                                      commitCell(key);
                                    }
                                    if (e.key === "Escape") cancelCell();
                                  }}
                                  onBlur={() => commitCell(key)}
                                  className="w-11 text-center text-[11px] border border-blue-300 rounded px-1 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                                />
                              )}
                            </div>
                          ) : (
                            /* ── Display mode ── */
                            <div
                              className={`cursor-pointer rounded mx-0.5 py-1 flex flex-col items-center justify-center min-h-[36px] transition-colors ${
                                isDirty
                                  ? "bg-amber-50 border border-amber-200"
                                  : hasValue
                                  ? "bg-blue-50 hover:bg-blue-100"
                                  : "hover:bg-gray-100"
                              }`}
                            >
                              {hasValue ? (
                                <>
                                  <span
                                    className={`text-[11px] font-bold leading-none ${
                                      isDirty ? "text-amber-700" : "text-blue-700"
                                    }`}
                                  >
                                    {val.totalLiters.toFixed(1)}
                                  </span>
                                  {isSplit && val.morningLiters != null && (
                                    <span className="text-[8px] text-gray-400 mt-0.5 leading-none">
                                      {(val.morningLiters ?? 0).toFixed(1)}+
                                      {(val.eveningLiters ?? 0).toFixed(1)}
                                    </span>
                                  )}
                                </>
                              ) : (
                                <span className="text-gray-300 text-[11px]">—</span>
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })}

                    {/* Row total — sticky right */}
                    <td className={`sticky right-0 z-10 px-3 py-2.5 text-center border-l border-gray-200 ${rowBg}`}>
                      <span
                        className={`text-sm font-bold ${
                          cTotal > 0 ? "text-blue-600" : "text-gray-300"
                        }`}
                      >
                        {cTotal > 0 ? cTotal.toFixed(1) : "—"}
                      </span>
                    </td>
                  </tr>
                );
              })}

              {/* ── Column totals row ── */}
              <tr className="border-t-2 border-gray-300 bg-gray-50">
                <td className="sticky left-0 z-10 bg-gray-50 px-3 py-3 border-r border-gray-200">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">
                    Day Total
                  </span>
                </td>
                {days.map((day) => {
                  const total = colTotal(day);
                  const { isToday, isSunday } = getDayMeta(year, month, day);
                  return (
                    <td
                      key={day}
                      className={`px-0.5 py-2 text-center ${
                        isToday ? "bg-blue-50" : isSunday ? "bg-red-50/30" : ""
                      }`}
                    >
                      {total > 0 ? (
                        <span className="text-[10px] font-bold text-gray-700">
                          {total.toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-gray-300 text-[10px]">—</span>
                      )}
                    </td>
                  );
                })}
                <td className="sticky right-0 z-10 bg-gray-50 px-3 py-3 text-center border-l border-gray-200">
                  <span className="text-sm font-extrabold text-gray-900">
                    {grandTotal.toFixed(1)}
                  </span>
                  <p className="text-[9px] text-gray-400">L total</p>
                </td>
              </tr>
            </tbody>
          </table>

          {customers.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <p className="font-medium">No active customers</p>
              <p className="text-sm mt-1">Add customers first to see their monthly data</p>
            </div>
          )}
          {customers.length > 0 && visibleCustomers.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <p className="font-medium">No customers match &ldquo;{searchQuery}&rdquo;</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Legend ── */}
      <div className="flex items-center gap-4 text-xs text-gray-400 flex-wrap">
        <div className="flex items-center gap-1.5">
          <div className="w-3.5 h-3.5 rounded bg-blue-50 border border-blue-200" />
          <span>Has entry</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3.5 h-3.5 rounded bg-amber-50 border border-amber-200" />
          <span>Modified (unsaved)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3.5 h-3.5 rounded bg-red-50 border border-red-100" />
          <span>Sunday</span>
        </div>
        <span>&bull; Click any cell to edit &bull; Enter / Tab to confirm &bull; Esc to cancel</span>
        {isSplit && <span>&bull; SPLIT mode: M = Morning, E = Evening</span>}
      </div>
    </div>
  );
}

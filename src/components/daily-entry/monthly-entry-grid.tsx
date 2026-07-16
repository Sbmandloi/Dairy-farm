"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SearchBar } from "@/components/ui/search-bar";
import { cn } from "@/lib/utils";
import { saveMonthlyEntriesAction, copyPreviousDayAction } from "@/lib/actions/daily-entry.actions";
import { todayInAppTz } from "@/lib/utils/date";
import {
  ChevronLeft,
  ChevronRight,
  Save,
  Loader2,
  CheckCircle2,
  ClipboardPaste,
  Droplets,
  Users,
  TrendingUp,
  CalendarDays,
  AlertCircle,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface MonthlyCustomer {
  id: string;
  name: string;
  phoneNumber: string | null;
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
function weekdayOf(year: number, month: number, day: number) {
  const d = new Date(year, month - 1, day);
  return { weekday: d.toLocaleDateString("en-IN", { weekday: "short" }), dow: d.getDay() };
}

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

  // "Today" in the dairy's timezone — for the today-column highlight and the
  // "paste yesterday into today" action (only meaningful in the current month).
  const [ty, tm, td] = todayInAppTz().split("-").map(Number);
  const isCurrentMonth = ty === year && tm === month;
  const todayDay = td;

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

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editTotal, setEditTotal] = useState("");
  const [editMorning, setEditMorning] = useState("");
  const [editEvening, setEditEvening] = useState("");

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [pasting, setPasting] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  // ─── Cell edit ─────────────────────────────────────────────────────────────

  function openCell(key: string) {
    if (editingKey === key) return;
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
        setData((d) => ({
          ...d,
          [key]: { totalLiters: totalL, morningLiters: morningL, eveningLiters: eveningL },
        }));
        setDirty((d) => new Set([...d, key]));
        setSaved(false);
        setNote(null);
      }
    },
    [editingKey, isSplit, editTotal, editMorning, editEvening, data]
  );

  function cancelCell() {
    setEditingKey(null);
  }

  // ─── Actions ───────────────────────────────────────────────────────────────

  async function handlePasteYesterday() {
    if (!isCurrentMonth) return;
    setPasting(true);
    setNote(null);
    setError("");
    try {
      const result = await copyPreviousDayAction(dateStr(year, month, todayDay));
      if (!result.success) {
        setError(result.error ?? "Failed to paste yesterday's entries");
        return;
      }
      if (result.data.length === 0) {
        setNote("Yesterday had no entries — nothing to paste.");
        setTimeout(() => setNote(null), 4000);
        return;
      }
      setData((d) => {
        const next = { ...d };
        for (const entry of result.data) {
          next[`${entry.customerId}-${todayDay}`] = {
            totalLiters: entry.totalLiters,
            morningLiters: entry.morningLiters,
            eveningLiters: entry.eveningLiters,
          };
        }
        return next;
      });
      setDirty((prev) => {
        const next = new Set(prev);
        for (const entry of result.data) next.add(`${entry.customerId}-${todayDay}`);
        return next;
      });
      setSaved(false);
      setNote(
        `Pasted ${result.data.length} entr${result.data.length === 1 ? "y" : "ies"} from yesterday into ${MONTH_NAMES[month - 1]} ${todayDay}. Click Save to persist.`
      );
    } finally {
      setPasting(false);
    }
  }

  async function handleSave() {
    if (editingKey) commitCell(editingKey);
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

  function navigate(delta: number) {
    let m = month + delta;
    let y = year;
    if (m > 12) { m = 1; y++; }
    if (m < 1) { m = 12; y--; }
    router.push(`/monthly-entry?year=${y}&month=${m}`);
  }

  // ─── Horizontal scroll controls (so every day column is reachable) ─────────
  const CUST_COL = 140;
  const DAY_COL = 52;
  const scrollRef = useRef<HTMLDivElement>(null);
  function scrollDays(cols: number) {
    scrollRef.current?.scrollBy({ left: cols * DAY_COL, behavior: "smooth" });
  }
  function scrollToDay(day: number) {
    // Land the target column a few cells in from the sticky customer column.
    scrollRef.current?.scrollTo({ left: Math.max(0, (day - 3) * DAY_COL + CUST_COL), behavior: "smooth" });
  }

  // On opening the current month, jump the grid to today so the relevant days
  // are on screen immediately (instead of starting at day 1).
  useEffect(() => {
    if (isCurrentMonth && scrollRef.current) {
      scrollRef.current.scrollLeft = Math.max(0, (todayDay - 3) * DAY_COL + CUST_COL);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Aggregates ──────────────────────────────────────────────────────────

  const rowTotal = useCallback(
    (customerId: string) => days.reduce((s, d) => s + (data[`${customerId}-${d}`]?.totalLiters ?? 0), 0),
    [data, days]
  );
  const colTotal = useCallback(
    (day: number) => customers.reduce((s, c) => s + (data[`${c.id}-${day}`]?.totalLiters ?? 0), 0),
    [data, customers]
  );

  const grandTotal = customers.reduce((s, c) => s + rowTotal(c.id), 0);
  const daysWithEntries = days.filter((d) => colTotal(d) > 0).length;

  const visibleCustomers = searchQuery
    ? customers.filter(
        (c) =>
          c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (c.phoneNumber?.includes(searchQuery) ?? false)
      )
    : customers;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className={cn("space-y-4", dirty.size > 0 && "pb-24")}>
      {/* ── Month navigator ── */}
      <div className="bg-white border border-gray-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="min-w-[150px] text-center">
            <p className="font-extrabold text-gray-900 text-lg leading-tight">
              {MONTH_NAMES[month - 1]} {year}
            </p>
            <p className="text-xs text-gray-400">
              {daysInMonth} days · {customers.length} customers
            </p>
          </div>
          <Button variant="outline" size="icon" onClick={() => navigate(1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          {!isCurrentMonth && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/monthly-entry")}
              className="text-blue-600"
            >
              This month
            </Button>
          )}
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          <SearchBar
            placeholder="Filter customers…"
            onSearch={setSearchQuery}
            className="w-40 sm:w-52"
          />
          {isCurrentMonth && (
            <Button
              variant="outline"
              size="sm"
              onClick={handlePasteYesterday}
              disabled={pasting}
              title="Fill today's column with yesterday's entries for every customer"
              className="flex-shrink-0"
            >
              {pasting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardPaste className="w-4 h-4" />}
              Paste Yesterday
            </Button>
          )}
        </div>
      </div>

      {note && (
        <div className="flex items-center gap-2 text-sm text-blue-800 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
          <ClipboardPaste className="w-4 h-4 flex-shrink-0" />
          {note}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}
      {searchQuery && (
        <p className="text-xs text-gray-500 px-1">
          Showing {visibleCustomers.length} of {customers.length} customers
        </p>
      )}

      {/* ── Summary tiles ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryTile icon={Droplets} tint="blue" label="Total Milk" value={`${grandTotal.toFixed(1)} L`} />
        <SummaryTile icon={Users} tint="violet" label="Customers" value={String(customers.length)} />
        <SummaryTile icon={CalendarDays} tint="teal" label="Active Days" value={String(daysWithEntries)} />
        <SummaryTile
          icon={TrendingUp}
          tint="green"
          label="Avg / Active Day"
          value={daysWithEntries ? `${(grandTotal / daysWithEntries).toFixed(1)} L` : "—"}
        />
      </div>

      {/* ── Grid ── */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        {/* Scroll controls — every day column is reachable via these or the scrollbar */}
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-gray-100 bg-gray-50/60">
          <p className="hidden sm:block text-xs text-gray-500">
            Scroll across to reach all <span className="font-semibold text-gray-700">{daysInMonth}</span> days · click any cell to fill it
          </p>
          <div className="flex items-center gap-1 ml-auto">
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => scrollDays(-7)} title="Scroll back a week">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            {isCurrentMonth ? (
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => scrollToDay(todayDay)}>
                Today
              </Button>
            ) : (
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => scrollToDay(1)}>
                Start
              </Button>
            )}
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => scrollDays(7)} title="Scroll forward a week">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div ref={scrollRef} className="grid-scroll overflow-x-auto" onClick={() => editingKey && cancelCell()}>
          <table className="border-collapse text-sm" style={{ minWidth: `${140 + daysInMonth * 52 + 76}px` }}>
            <colgroup>
              <col style={{ width: 140, minWidth: 140 }} />
              {days.map((d) => <col key={d} style={{ width: 52, minWidth: 44 }} />)}
              <col style={{ width: 76, minWidth: 76 }} />
            </colgroup>

            <thead>
              <tr className="bg-gray-50 border-b-2 border-gray-200">
                <th className="sticky left-0 z-20 bg-gray-50 px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200">
                  Customer
                </th>
                {days.map((day) => {
                  const { weekday, dow } = weekdayOf(year, month, day);
                  const isToday = isCurrentMonth && day === todayDay;
                  const isSunday = dow === 0;
                  return (
                    <th
                      key={day}
                      className={cn(
                        "px-0.5 py-2 text-center",
                        isToday ? "bg-blue-100 text-blue-700" : isSunday ? "bg-red-50 text-red-400" : "text-gray-500"
                      )}
                    >
                      <div className="text-xs font-bold leading-none">{day}</div>
                      <div className="text-[9px] font-normal opacity-60 mt-0.5">{weekday}</div>
                    </th>
                  );
                })}
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
                  <tr key={customer.id} className={cn("border-b border-gray-100 last:border-0", rowBg)}>
                    <td className={cn("sticky left-0 z-10 px-3 py-2.5 border-r border-gray-200", rowBg)}>
                      <div className="flex items-center gap-2">
                        <div className={cn("w-7 h-7 rounded-lg flex-shrink-0 grid place-items-center text-[10px] font-bold text-white", avatarColor(customer.name))}>
                          {getInitials(customer.name)}
                        </div>
                        <p className="text-xs font-semibold text-gray-900 truncate max-w-[90px]">
                          {customer.name}
                        </p>
                      </div>
                    </td>

                    {days.map((day) => {
                      const key = `${customer.id}-${day}`;
                      const val = data[key];
                      const isEditing = editingKey === key;
                      const isDirty = dirty.has(key);
                      const hasValue = val && val.totalLiters > 0;
                      const isToday = isCurrentMonth && day === todayDay;
                      const isSunday = weekdayOf(year, month, day).dow === 0;

                      return (
                        <td
                          key={day}
                          className={cn(
                            "px-0.5 py-0.5 align-middle",
                            isToday ? "bg-blue-50/60" : isSunday ? "bg-red-50/20" : ""
                          )}
                          onClick={(e) => {
                            e.stopPropagation();
                            openCell(key);
                          }}
                        >
                          {isEditing ? (
                            <div className="flex flex-col gap-0.5 items-center" onClick={(e) => e.stopPropagation()}>
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
                                      setEditTotal(String((parseFloat(e.target.value) || 0) + (parseFloat(editEvening) || 0)));
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); commitCell(key); }
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
                                      setEditTotal(String((parseFloat(editMorning) || 0) + (parseFloat(e.target.value) || 0)));
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); commitCell(key); }
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
                                    if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); commitCell(key); }
                                    if (e.key === "Escape") cancelCell();
                                  }}
                                  onBlur={() => commitCell(key)}
                                  className="w-11 text-center text-[11px] border border-blue-300 rounded px-1 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                                />
                              )}
                            </div>
                          ) : (
                            <div
                              className={cn(
                                "cursor-pointer rounded mx-0.5 py-1 flex flex-col items-center justify-center min-h-[36px] transition-colors",
                                isDirty
                                  ? "bg-amber-100 border border-amber-300"
                                  : hasValue
                                  ? "bg-blue-50 hover:bg-blue-100"
                                  : "hover:bg-gray-100"
                              )}
                            >
                              {hasValue ? (
                                <>
                                  <span className={cn("text-[11px] font-bold leading-none", isDirty ? "text-amber-700" : "text-blue-700")}>
                                    {val.totalLiters.toFixed(1)}
                                  </span>
                                  {isSplit && val.morningLiters != null && (
                                    <span className="text-[8px] text-gray-400 mt-0.5 leading-none">
                                      {(val.morningLiters ?? 0).toFixed(1)}+{(val.eveningLiters ?? 0).toFixed(1)}
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

                    <td className={cn("sticky right-0 z-10 px-3 py-2.5 text-center border-l border-gray-200", rowBg)}>
                      <span className={cn("text-sm font-bold", cTotal > 0 ? "text-blue-600" : "text-gray-300")}>
                        {cTotal > 0 ? cTotal.toFixed(1) : "—"}
                      </span>
                    </td>
                  </tr>
                );
              })}

              {/* Column totals */}
              <tr className="border-t-2 border-gray-300 bg-gray-50">
                <td className="sticky left-0 z-10 bg-gray-50 px-3 py-3 border-r border-gray-200">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Day Total</span>
                </td>
                {days.map((day) => {
                  const total = colTotal(day);
                  const isToday = isCurrentMonth && day === todayDay;
                  const isSunday = weekdayOf(year, month, day).dow === 0;
                  return (
                    <td key={day} className={cn("px-0.5 py-2 text-center", isToday ? "bg-blue-50" : isSunday ? "bg-red-50/30" : "")}>
                      {total > 0 ? (
                        <span className="text-[10px] font-bold text-gray-700">{total.toFixed(1)}</span>
                      ) : (
                        <span className="text-gray-300 text-[10px]">—</span>
                      )}
                    </td>
                  );
                })}
                <td className="sticky right-0 z-10 bg-gray-50 px-3 py-3 text-center border-l border-gray-200">
                  <span className="text-sm font-extrabold text-gray-900">{grandTotal.toFixed(1)}</span>
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
        <LegendSwatch className="bg-blue-50 border-blue-200" label="Has entry" />
        <LegendSwatch className="bg-amber-100 border-amber-300" label="Modified (unsaved)" />
        <LegendSwatch className="bg-red-50 border-red-100" label="Sunday" />
        <span>· Click any cell to edit · Enter / Tab to confirm · Esc to cancel</span>
        {isSplit && <span>· SPLIT: M = Morning, E = Evening</span>}
      </div>

      {/* ── Sticky save bar ── */}
      {(dirty.size > 0 || saving || saved) && (
        <div className="fixed bottom-0 left-0 right-0 lg:left-64 z-40 border-t border-gray-200 bg-white/95 backdrop-blur px-4 py-3 mb-[68px] lg:mb-0 shadow-[0_-2px_8px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between gap-3 max-w-5xl mx-auto">
            <div className="text-sm min-w-0">
              {saved ? (
                <span className="flex items-center gap-1.5 text-green-600 font-medium">
                  <CheckCircle2 className="w-4 h-4" /> Saved
                </span>
              ) : (
                <span className="text-gray-600 truncate">
                  <span className="font-semibold text-amber-600">{dirty.size}</span> unsaved change{dirty.size === 1 ? "" : "s"} ·{" "}
                  <span className="font-bold text-blue-600">{grandTotal.toFixed(1)} L</span> total
                </span>
              )}
            </div>
            <Button size="sm" onClick={handleSave} disabled={saving || dirty.size === 0} className="flex-shrink-0 min-w-28">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? "Saving…" : `Save (${dirty.size})`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Small building blocks ───────────────────────────────────────────────────

const TILE_TINTS: Record<string, string> = {
  blue: "bg-blue-50 text-blue-500 border-blue-100",
  violet: "bg-violet-50 text-violet-500 border-violet-100",
  teal: "bg-teal-50 text-teal-500 border-teal-100",
  green: "bg-green-50 text-green-500 border-green-100",
};

function SummaryTile({
  icon: Icon,
  tint,
  label,
  value,
}: {
  icon: React.ElementType;
  tint: keyof typeof TILE_TINTS;
  label: string;
  value: string;
}) {
  return (
    <div className={cn("border rounded-xl p-3 flex items-center gap-3", TILE_TINTS[tint])}>
      <div className="w-9 h-9 rounded-lg bg-white/70 grid place-items-center flex-shrink-0">
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 truncate">{label}</p>
        <p className="font-bold text-gray-900 truncate">{value}</p>
      </div>
    </div>
  );
}

function LegendSwatch({ className, label }: { className: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={cn("w-3.5 h-3.5 rounded border", className)} />
      <span>{label}</span>
    </div>
  );
}

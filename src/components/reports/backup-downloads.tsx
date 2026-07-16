"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils/format";
import {
  Download, Loader2, Archive, Calendar, Clock, DatabaseBackup,
  FileSpreadsheet, Info, CheckCircle2, AlertTriangle, ShieldAlert,
} from "lucide-react";

interface Period {
  value: string;
  label: string;
}

interface BackupDownloadsProps {
  months: Period[];
  weeks: Period[];
  /** ISO timestamp of the last full JSON backup, or null if never taken. */
  lastBackupAt: string | null;
}

/**
 * How stale the off-site backup is.
 *
 * Thresholds assume the JSON download is the *off-provider* copy taken roughly
 * monthly (Neon's own snapshots/PITR cover the recent window), so 30 days is
 * the point at which it's worth nagging — not 24 hours.
 */
function backupStatus(lastBackupAt: string | null) {
  if (!lastBackupAt) {
    return {
      tone: "bg-red-50 border-red-200 text-red-800",
      icon: ShieldAlert,
      title: "No backup taken yet",
      detail: "Download a full backup and keep it somewhere outside the app (e.g. Google Drive).",
    };
  }
  const days = Math.floor((Date.now() - new Date(lastBackupAt).getTime()) / 86_400_000);
  const when =
    days <= 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;

  if (days > 30) {
    return {
      tone: "bg-amber-50 border-amber-200 text-amber-900",
      icon: AlertTriangle,
      title: `Last backup ${when} — time for a fresh one`,
      detail: `Taken on ${formatDate(lastBackupAt)}. Anything entered since then only exists in the database.`,
    };
  }
  return {
    tone: "bg-green-50 border-green-200 text-green-800",
    icon: CheckCircle2,
    title: `Last backup ${when}`,
    detail: `Taken on ${formatDate(lastBackupAt)}.`,
  };
}

export function BackupDownloads({ months, weeks, lastBackupAt }: BackupDownloadsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const status = backupStatus(lastBackupAt);

  /** One download path for every button — fetch, blob, click, clean up. */
  async function download(key: string, url: string, filename: string) {
    setLoading(key);
    setError("");
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
      // The JSON route stamps lastBackupAt — re-render so the status reflects it.
      if (key === "json") router.refresh();
    } catch {
      setError("Download failed. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  const stamp = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      {/* Backup status — the real risk here is forgetting, so make it loud. */}
      <div className={cn("flex items-start gap-3 rounded-xl border px-4 py-3", status.tone)}>
        <status.icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="font-semibold text-sm">{status.title}</p>
          <p className="text-xs opacity-90 mt-0.5">{status.detail}</p>
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {/* ── The two whole-database backups ── */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Restorable JSON — the real disaster-recovery backup */}
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-full grid place-items-center flex-shrink-0">
                <DatabaseBackup className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-gray-900">Full Restorable Backup</p>
                <p className="text-xs text-gray-500">
                  Complete database snapshot — JSON
                </p>
              </div>
            </div>
            <p className="text-xs text-emerald-800 bg-emerald-100/70 rounded-lg px-3 py-2">
              Everything: customers (including archived), entries, bills, payments and
              settings — with exact amounts and IDs preserved. <strong>This is the only
              backup that can be restored.</strong> Keep it somewhere safe.
            </p>
            <Button
              onClick={() =>
                download("json", "/api/export/backup/json", `dairy-backup-full-${stamp}.json`)
              }
              disabled={!!loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700"
            >
              {loading === "json" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              Download Full Backup (JSON)
            </Button>
          </CardContent>
        </Card>

        {/* All-time CSV — readable, not restorable */}
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full grid place-items-center flex-shrink-0">
                <Archive className="w-5 h-5 text-blue-600" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-gray-900">All-Time Export</p>
                <p className="text-xs text-gray-500">
                  Readable spreadsheet — CSV
                </p>
              </div>
            </div>
            <p className="text-xs text-blue-800 bg-blue-100/70 rounded-lg px-3 py-2">
              All daily entries, bills and payments in a spreadsheet you can open in
              Excel. For reading and sharing — <strong>not restorable</strong>.
            </p>
            <Button
              onClick={() =>
                download("all", "/api/export/backup?type=all", "dairy-backup-all-time.csv")
              }
              disabled={!!loading}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              {loading === "all" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              Download All Time (CSV)
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* ── Period CSV exports ── */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Calendar className="w-4 h-4 text-green-600" />
              Monthly Exports
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
              {months.map((m) => (
                <PeriodRow
                  key={m.value}
                  label={m.label}
                  loading={loading === `month-${m.value}`}
                  disabled={!!loading}
                  tone="green"
                  onClick={() =>
                    download(
                      `month-${m.value}`,
                      `/api/export/backup?type=month&value=${encodeURIComponent(m.value)}`,
                      `dairy-backup-${m.value}.csv`
                    )
                  }
                />
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-purple-600" />
              Weekly Exports
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
              {weeks.map((w) => (
                <PeriodRow
                  key={w.value}
                  label={w.label}
                  loading={loading === `week-${w.value}`}
                  disabled={!!loading}
                  tone="purple"
                  onClick={() =>
                    download(
                      `week-${w.value}`,
                      `/api/export/backup?type=week&value=${encodeURIComponent(w.value)}`,
                      `dairy-backup-${w.value}.csv`
                    )
                  }
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-start gap-2 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5">
        <Info className="w-4 h-4 flex-shrink-0 mt-px text-gray-400" />
        <p>
          <strong className="text-gray-700">CSV vs JSON:</strong> CSV exports are for
          reading in Excel and cannot be imported back. To actually restore the
          database, use the JSON backup with{" "}
          <code className="bg-gray-200 rounded px-1 py-0.5 font-mono text-[11px]">
            npm run db:restore -- &lt;file.json&gt;
          </code>
          .
        </p>
      </div>
    </div>
  );
}

function PeriodRow({
  label,
  loading,
  disabled,
  tone,
  onClick,
}: {
  label: string;
  loading: boolean;
  disabled: boolean;
  tone: "green" | "purple";
  onClick: () => void;
}) {
  const tones = {
    green: loading
      ? "bg-green-100 text-green-500 cursor-wait"
      : "bg-green-50 text-green-700 hover:bg-green-100",
    purple: loading
      ? "bg-purple-100 text-purple-500 cursor-wait"
      : "bg-purple-50 text-purple-700 hover:bg-purple-100",
  } as const;

  return (
    <div className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 transition-colors">
      <span className="text-sm text-gray-700 pr-2">{label}</span>
      <button
        onClick={onClick}
        disabled={disabled}
        className={`flex-shrink-0 flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors ${tones[tone]}`}
      >
        {loading ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <FileSpreadsheet className="w-3 h-3" />
        )}
        CSV
      </button>
    </div>
  );
}

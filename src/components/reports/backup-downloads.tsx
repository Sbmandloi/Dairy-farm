"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Loader2, Archive, Calendar, Clock } from "lucide-react";

interface Period {
  value: string;
  label: string;
}

interface BackupDownloadsProps {
  months: Period[];
  weeks: Period[];
}

export function BackupDownloads({ months, weeks }: BackupDownloadsProps) {
  const [loading, setLoading] = useState<string | null>(null);

  async function downloadBackup(type: string, value: string, filename: string) {
    const key = `${type}-${value}`;
    setLoading(key);
    try {
      const res = await fetch(`/api/export/backup?type=${type}&value=${encodeURIComponent(value)}`);
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert("Download failed. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  async function downloadAllTime() {
    setLoading("all");
    try {
      const res = await fetch(`/api/export/backup?type=all`);
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "dairy-backup-all-time.csv";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert("Download failed. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* All-time backup */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <Archive className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">Complete Backup</p>
              <p className="text-sm text-gray-500">All daily entries, bills, and payments</p>
            </div>
          </div>
          <Button
            onClick={downloadAllTime}
            disabled={!!loading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {loading === "all" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Download All Time
          </Button>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Monthly backups */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Calendar className="w-4 h-4 text-green-600" />
              Monthly Backups
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-gray-100">
              {months.map((m) => {
                const key = `month-${m.value}`;
                const isLoading = loading === key;
                return (
                  <div
                    key={m.value}
                    className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 transition-colors"
                  >
                    <span className="text-sm text-gray-700">{m.label}</span>
                    <button
                      onClick={() =>
                        downloadBackup("month", m.value, `dairy-backup-${m.value}.csv`)
                      }
                      disabled={!!loading}
                      className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors ${
                        isLoading
                          ? "bg-green-100 text-green-500 cursor-wait"
                          : "bg-green-50 text-green-700 hover:bg-green-100"
                      }`}
                    >
                      {isLoading ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Download className="w-3 h-3" />
                      )}
                      CSV
                    </button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Weekly backups */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-purple-600" />
              Weekly Backups
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
              {weeks.map((w) => {
                const key = `week-${w.value}`;
                const isLoading = loading === key;
                return (
                  <div
                    key={w.value}
                    className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 transition-colors"
                  >
                    <span className="text-sm text-gray-700 pr-2">{w.label}</span>
                    <button
                      onClick={() =>
                        downloadBackup("week", w.value, `dairy-backup-${w.value}.csv`)
                      }
                      disabled={!!loading}
                      className={`flex-shrink-0 flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors ${
                        isLoading
                          ? "bg-purple-100 text-purple-500 cursor-wait"
                          : "bg-purple-50 text-purple-700 hover:bg-purple-100"
                      }`}
                    >
                      {isLoading ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Download className="w-3 h-3" />
                      )}
                      CSV
                    </button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-gray-400 text-center">
        Backups include daily milk entries, bills, and payment records for the selected period.
      </p>
    </div>
  );
}

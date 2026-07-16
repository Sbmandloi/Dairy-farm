"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

/**
 * Keeps the (server-rendered) dashboard feeling live: silently re-fetches on an
 * interval via router.refresh(), plus a manual refresh button showing how long
 * ago the data was loaded.
 *
 * `generatedAt` changes on every server render; when fresh data arrives we reset
 * the "updated Ns ago" counter off the client clock (avoids server/client skew).
 */
export function AutoRefresh({
  generatedAt,
  intervalMs = 30_000,
}: {
  generatedAt: number;
  intervalMs?: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [loadedAt, setLoadedAt] = useState(() => Date.now());
  const [, forceTick] = useState(0);

  // Reset the counter whenever a fresh server render lands.
  useEffect(() => {
    setLoadedAt(Date.now());
  }, [generatedAt]);

  // Re-render every second so the label stays current.
  useEffect(() => {
    const t = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Auto-refresh on the interval.
  useEffect(() => {
    const t = setInterval(
      () => startTransition(() => router.refresh()),
      intervalMs
    );
    return () => clearInterval(t);
  }, [router, intervalMs]);

  const seconds = Math.max(0, Math.round((Date.now() - loadedAt) / 1000));
  const label =
    isPending || seconds < 3
      ? "just now"
      : seconds < 60
        ? `${seconds}s ago`
        : `${Math.floor(seconds / 60)}m ago`;

  return (
    <button
      type="button"
      onClick={() => startTransition(() => router.refresh())}
      title="Refresh dashboard"
      className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition-colors"
    >
      <RefreshCw className={`w-3.5 h-3.5 ${isPending ? "animate-spin" : ""}`} />
      <span className="hidden sm:inline">Updated {label}</span>
    </button>
  );
}

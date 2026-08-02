import { getReportsData } from "@/lib/services/report.service";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, formatLiters, formatDate, formatMonth } from "@/lib/utils/format";
import Link from "next/link";
import { BackupDownloads } from "@/components/reports/backup-downloads";
import { cn } from "@/lib/utils";
import {
  Receipt,
  Droplets,
  IndianRupee,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  Trophy,
  Wallet,
  Archive,
} from "lucide-react";

export default async function ReportsPage() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Every figure below comes from one service, which the Android app reads too —
  // so the web page and the phone can never disagree about the numbers.
  const { allTime, monthlySummary, topCustomers, recentPayments, lastBackupAt } =
    await getReportsData();

  // Build months list for backup tab
  const backupMonths = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return {
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleString("en-IN", { month: "long", year: "numeric" }),
    };
  });

  // Build ISO weeks for last 12 weeks
  const backupWeeks = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    const year = d.getFullYear();
    // ISO week number
    const jan4 = new Date(year, 0, 4);
    const startOfWeek1 = new Date(jan4);
    startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() || 7) - 1));
    const weekNum =
      Math.floor(
        (d.getTime() - startOfWeek1.getTime()) / (7 * 24 * 60 * 60 * 1000)
      ) + 1;
    const weekStart = new Date(startOfWeek1);
    weekStart.setDate(startOfWeek1.getDate() + (weekNum - 1) * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    return {
      value: `${year}-W${String(weekNum).padStart(2, "0")}`,
      label: `Week ${weekNum} (${weekStart.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – ${weekEnd.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })})`,
    };
  }).filter((w, i, arr) => arr.findIndex((x) => x.value === w.value) === i);

  return (
    <div>
      <Header title="Reports" />
      <div className="p-4 md:p-6 space-y-6">
        {/* Intro */}
        <div className="flex items-start gap-3">
          <div className="hidden sm:grid place-items-center w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex-shrink-0">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Reports &amp; history</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              All-time performance, monthly trends, your best customers, and backups.
            </p>
          </div>
        </div>

        {/* All-time stats — outstanding is derived from the figures already shown */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            {
              label: "Total Bills",
              value: allTime.totalBills.toString(),
              icon: Receipt,
              tint: "bg-slate-50 border-slate-200 text-slate-500",
            },
            {
              label: "Total Liters",
              value: formatLiters(allTime.totalLiters),
              icon: Droplets,
              tint: "bg-blue-50 border-blue-100 text-blue-500",
            },
            {
              label: "Total Billed",
              value: formatCurrency(allTime.totalBilled),
              icon: IndianRupee,
              tint: "bg-violet-50 border-violet-100 text-violet-500",
            },
            {
              label: "Total Collected",
              value: formatCurrency(allTime.totalCollected),
              icon: CheckCircle2,
              tint: "bg-green-50 border-green-100 text-green-500",
            },
            {
              label: "Outstanding",
              value: formatCurrency(allTime.outstanding),
              icon: AlertCircle,
              tint:
                allTime.outstanding > 0.01
                  ? "bg-orange-50 border-orange-100 text-orange-500"
                  : "bg-green-50 border-green-100 text-green-500",
            },
          ].map((stat) => (
            <div key={stat.label} className={cn("border rounded-xl p-3.5 flex items-center gap-3", stat.tint)}>
              <div className="w-9 h-9 rounded-lg bg-white/70 grid place-items-center flex-shrink-0">
                <stat.icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-gray-500 uppercase tracking-wide truncate">{stat.label}</p>
                <p className="font-bold text-gray-900 truncate">{stat.value}</p>
              </div>
            </div>
          ))}
        </div>

        <Tabs defaultValue="monthly">
          <TabsList>
            <TabsTrigger value="monthly" className="gap-1.5">
              <BarChart3 className="w-3.5 h-3.5" />
              Monthly Summary
            </TabsTrigger>
            <TabsTrigger value="top-customers" className="gap-1.5">
              <Trophy className="w-3.5 h-3.5" />
              Top Customers
            </TabsTrigger>
            <TabsTrigger value="payments" className="gap-1.5">
              <Wallet className="w-3.5 h-3.5" />
              Recent Payments
            </TabsTrigger>
            <TabsTrigger value="backup" className="gap-1.5">
              <Archive className="w-3.5 h-3.5" />
              Backup &amp; Export
            </TabsTrigger>
          </TabsList>

          <TabsContent value="monthly" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Monthly Billing Summary (Last 12 Months)</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left px-4 py-3 font-medium text-gray-600">Month</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600">Bills</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600">Liters</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlySummary.map((row) => (
                        <tr key={row.periodStart} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-700">
                            <Link href={`/billing?year=${row.year}&month=${row.month}`} className="hover:text-blue-600">
                              {formatMonth(row.periodStart)}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-right text-gray-600">{row.bills}</td>
                          <td className="px-4 py-3 text-right text-gray-600">{formatLiters(row.liters)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(row.amount)}</td>
                        </tr>
                      ))}
                      {monthlySummary.length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-12 text-center text-gray-400">
                            <BarChart3 className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                            <p className="font-medium text-gray-500">No billing history yet</p>
                            <p className="text-xs mt-1">Generate bills to see monthly trends here.</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="top-customers" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Top Customers — {formatMonth(monthStart)}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left px-4 py-3 font-medium text-gray-600">#</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-600">Customer</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600">Total Liters</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topCustomers.map((row, i) => {
                        // Medal colours for the top three, plain otherwise.
                        const rankTint =
                          i === 0
                            ? "bg-amber-100 text-amber-700"
                            : i === 1
                              ? "bg-slate-200 text-slate-600"
                              : i === 2
                                ? "bg-orange-100 text-orange-700"
                                : "bg-gray-50 text-gray-400";
                        return (
                          <tr key={row.customerId} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <span className={cn("inline-grid place-items-center w-6 h-6 rounded-full text-xs font-bold", rankTint)}>
                                {i + 1}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <Link href={`/customers/${row.customerId}`} className="font-medium text-gray-900 hover:text-blue-600">
                                {row.name}
                              </Link>
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-blue-600">
                              {formatLiters(row.liters)}
                            </td>
                          </tr>
                        );
                      })}
                      {topCustomers.length === 0 && (
                        <tr>
                          <td colSpan={3} className="py-12 text-center text-gray-400">
                            <Trophy className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                            <p className="font-medium text-gray-500">No entries this month</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Recent Payments</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left px-4 py-3 font-medium text-gray-600">Customer</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-600">Invoice</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600">Amount</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentPayments.map((p) => (
                        <tr key={p.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">{p.customerName}</td>
                          <td className="px-4 py-3 text-gray-500">
                            <Link href={`/billing/${p.billId}`} className="hover:text-blue-600">
                              {p.invoiceNumber}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-green-600">
                            {formatCurrency(p.amount)}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-500">{formatDate(p.paidOn)}</td>
                        </tr>
                      ))}
                      {recentPayments.length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-12 text-center text-gray-400">
                            <Wallet className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                            <p className="font-medium text-gray-500">No payments recorded</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="backup" className="mt-4">
            <BackupDownloads
              months={backupMonths}
              weeks={backupWeeks}
              lastBackupAt={lastBackupAt}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

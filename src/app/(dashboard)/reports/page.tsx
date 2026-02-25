import { prisma } from "@/lib/db";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, formatLiters, formatDate, formatMonth, decimalToNumber } from "@/lib/utils/format";
import { BILL_STATUS_LABELS, BILL_STATUS_COLORS } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { BackupDownloads } from "@/components/reports/backup-downloads";

export default async function ReportsPage() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  // Last 12 months billing summary
  const monthlySummary = await prisma.bill.groupBy({
    by: ["periodStart"],
    _sum: { totalAmount: true, totalLiters: true },
    _count: true,
    orderBy: { periodStart: "desc" },
    take: 12,
  });

  // Recent payments
  const recentPayments = await prisma.payment.findMany({
    take: 20,
    orderBy: { createdAt: "desc" },
    include: { bill: { include: { customer: true } } },
  });

  // Current month top customers
  const topCustomers = await prisma.dailyMilkEntry.groupBy({
    by: ["customerId"],
    where: { date: { gte: monthStart, lte: monthEnd } },
    _sum: { totalLiters: true },
    orderBy: { _sum: { totalLiters: "desc" } },
    take: 10,
  });

  const customerIds = topCustomers.map((c) => c.customerId);
  const customers = await prisma.customer.findMany({ where: { id: { in: customerIds } } });
  const customerMap = new Map(customers.map((c) => [c.id, c]));

  // Overall stats
  const totalAllTime = await prisma.bill.aggregate({
    _sum: { totalAmount: true, totalLiters: true },
    _count: true,
  });

  const totalPayments = await prisma.payment.aggregate({
    _sum: { amountPaid: true },
  });

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
        {/* All-time stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total Bills", value: totalAllTime._count.toString() },
            { label: "Total Liters", value: formatLiters(decimalToNumber(totalAllTime._sum.totalLiters)) },
            { label: "Total Billed", value: formatCurrency(decimalToNumber(totalAllTime._sum.totalAmount)) },
            { label: "Total Collected", value: formatCurrency(decimalToNumber(totalPayments._sum.amountPaid)) },
          ].map((stat) => (
            <Card key={stat.label} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-gray-500 font-medium">{stat.label}</p>
                <p className="text-xl font-bold text-gray-900 mt-1">{stat.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="monthly">
          <TabsList>
            <TabsTrigger value="monthly">Monthly Summary</TabsTrigger>
            <TabsTrigger value="top-customers">Top Customers</TabsTrigger>
            <TabsTrigger value="payments">Recent Payments</TabsTrigger>
            <TabsTrigger value="backup">Backup & Export</TabsTrigger>
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
                        <tr key={row.periodStart.toISOString()} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-700">
                            <Link href={`/billing?year=${row.periodStart.getFullYear()}&month=${row.periodStart.getMonth() + 1}`} className="hover:text-blue-600">
                              {formatMonth(row.periodStart)}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-right text-gray-600">{row._count}</td>
                          <td className="px-4 py-3 text-right text-gray-600">{formatLiters(decimalToNumber(row._sum.totalLiters))}</td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(decimalToNumber(row._sum.totalAmount))}</td>
                        </tr>
                      ))}
                      {monthlySummary.length === 0 && (
                        <tr><td colSpan={4} className="text-center py-8 text-gray-400">No billing history</td></tr>
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
                        const customer = customerMap.get(row.customerId);
                        return (
                          <tr key={row.customerId} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                            <td className="px-4 py-3 text-gray-400 font-medium">{i + 1}</td>
                            <td className="px-4 py-3">
                              <Link href={`/customers/${row.customerId}`} className="font-medium text-gray-900 hover:text-blue-600">
                                {customer?.name || "Unknown"}
                              </Link>
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-blue-600">
                              {formatLiters(decimalToNumber(row._sum.totalLiters))}
                            </td>
                          </tr>
                        );
                      })}
                      {topCustomers.length === 0 && (
                        <tr><td colSpan={3} className="text-center py-8 text-gray-400">No entries this month</td></tr>
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
                          <td className="px-4 py-3 font-medium text-gray-900">{p.bill.customer.name}</td>
                          <td className="px-4 py-3 text-gray-500">
                            <Link href={`/billing/${p.billId}`} className="hover:text-blue-600">
                              {p.bill.invoiceNumber}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-green-600">
                            {formatCurrency(decimalToNumber(p.amountPaid))}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-500">{formatDate(p.paidOn)}</td>
                        </tr>
                      ))}
                      {recentPayments.length === 0 && (
                        <tr><td colSpan={4} className="text-center py-8 text-gray-400">No payments recorded</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="backup" className="mt-4">
            <BackupDownloads months={backupMonths} weeks={backupWeeks} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

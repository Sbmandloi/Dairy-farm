import { getDashboardStats } from "@/lib/services/billing.service";
import { getDailyEntriesWithCustomers } from "@/lib/services/daily-entry.service";
import { formatCurrency, formatLiters, formatDate } from "@/lib/utils/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Header } from "@/components/layout/header";
import { auth } from "@/lib/auth";
import { Milk, Users, IndianRupee, Receipt, AlertCircle, ArrowRight, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BILL_STATUS_LABELS } from "@/lib/constants";
import { getPendingBills } from "@/lib/services/billing.service";
import { decimalToNumber } from "@/lib/utils/format";

export default async function DashboardPage() {
  const session = await auth();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [stats, todayEntries, pendingBills] = await Promise.all([
    getDashboardStats(),
    getDailyEntriesWithCustomers(today),
    getPendingBills(),
  ]);

  const statCards = [
    {
      title: "Today's Milk",
      value: formatLiters(stats.todayLiters),
      sub: formatCurrency(stats.todayRevenue) + " est. revenue",
      icon: Milk,
      color: "text-blue-600",
      bg: "bg-blue-50",
      border: "border-blue-100",
      href: "/daily-entry",
    },
    {
      title: "This Month",
      value: formatLiters(stats.monthLiters),
      sub: formatCurrency(stats.monthRevenue) + " est. revenue",
      icon: IndianRupee,
      color: "text-green-600",
      bg: "bg-green-50",
      border: "border-green-100",
      href: "/billing",
    },
    {
      title: "Active Customers",
      value: stats.activeCustomers.toString(),
      sub: "registered customers",
      icon: Users,
      color: "text-purple-600",
      bg: "bg-purple-50",
      border: "border-purple-100",
      href: "/customers",
    },
    {
      title: "Pending Bills",
      value: stats.pendingBills.toString(),
      sub: formatCurrency(stats.pendingAmount) + " outstanding",
      icon: Receipt,
      color: "text-orange-600",
      bg: "bg-orange-50",
      border: "border-orange-100",
      href: "/billing",
    },
  ];

  const todayWithEntry = todayEntries.filter((r) => r.entry).length;
  const todayTotal = todayEntries
    .filter((r) => r.entry)
    .reduce((s, r) => s + decimalToNumber(r.entry!.totalLiters), 0);

  return (
    <div>
      <Header title="Dashboard" userName={session?.user?.name ?? "Admin"} />

      <div className="p-4 md:p-6 space-y-6">
        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((card, i) => (
            <Link href={card.href} key={card.title}>
              <div
                className={`animate-fade-in-up stagger-${i + 1} border ${card.border} rounded-xl p-4 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer ${card.bg}`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-500">{card.title}</p>
                    <p className="text-xl font-bold text-gray-900 mt-1 leading-tight">{card.value}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{card.sub}</p>
                  </div>
                  <div className={`p-2.5 rounded-xl bg-white shadow-sm`}>
                    <card.icon className={`w-4 h-4 ${card.color}`} />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Today's progress bar */}
        {todayEntries.length > 0 && (
          <div className="animate-fade-in bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-gray-700">
                Today's Entry Progress
              </p>
              <p className="text-xs text-gray-400">
                {todayWithEntry} / {todayEntries.length} customers •{" "}
                <span className="font-bold text-blue-600">{formatLiters(todayTotal)}</span>
              </p>
            </div>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-700"
                style={{
                  width: `${
                    todayEntries.length > 0
                      ? Math.round((todayWithEntry / todayEntries.length) * 100)
                      : 0
                  }%`,
                }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1.5">
              {todayEntries.length - todayWithEntry > 0
                ? `${todayEntries.length - todayWithEntry} customers not yet entered`
                : "All entries recorded for today!"}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Today's Entry Summary */}
          <Card className="animate-fade-in-up stagger-2">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">
                  Today&apos;s Entries — {formatDate(today)}
                </CardTitle>
                <Link href="/daily-entry">
                  <Button variant="outline" size="sm" className="gap-1">
                    Add Entry
                    <ArrowRight className="w-3 h-3" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {todayEntries.length === 0 ? (
                <div className="text-center py-6 text-gray-400 text-sm">No active customers</div>
              ) : (
                <div className="space-y-1">
                  {todayEntries.slice(0, 7).map(({ customer, entry }) => (
                    <div
                      key={customer.id}
                      className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0 hover:bg-gray-50 rounded-lg px-2 -mx-2 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {entry ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                        ) : (
                          <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-200 flex-shrink-0" />
                        )}
                        <span className="text-sm font-medium text-gray-700">{customer.name}</span>
                      </div>
                      {entry ? (
                        <span className="text-sm font-bold text-blue-600">
                          {formatLiters(decimalToNumber(entry.totalLiters))}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300 italic">pending</span>
                      )}
                    </div>
                  ))}
                  {todayEntries.length > 7 && (
                    <Link href="/daily-entry" className="block">
                      <p className="text-xs text-blue-500 hover:text-blue-700 text-center pt-2 transition-colors">
                        View all {todayEntries.length} customers →
                      </p>
                    </Link>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pending Bills */}
          <Card className="animate-fade-in-up stagger-3">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Pending Bills</CardTitle>
                <Link href="/billing">
                  <Button variant="outline" size="sm" className="gap-1">
                    View All
                    <ArrowRight className="w-3 h-3" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {pendingBills.length === 0 ? (
                <div className="flex flex-col items-center py-6 text-gray-400">
                  <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mb-3">
                    <AlertCircle className="w-6 h-6 text-green-400" />
                  </div>
                  <p className="text-sm font-medium text-green-600">All bills are settled!</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {pendingBills.slice(0, 5).map((bill) => {
                    const paid = bill.payments.reduce((s, p) => s + decimalToNumber(p.amountPaid), 0);
                    const due = decimalToNumber(bill.totalAmount) - paid;
                    return (
                      <Link key={bill.id} href={`/billing/${bill.id}`}>
                        <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0 hover:bg-gray-50 rounded-lg px-2 -mx-2 transition-colors">
                          <div>
                            <p className="text-sm font-medium text-gray-700">{bill.customer.name}</p>
                            <p className="text-xs text-gray-400">{bill.invoiceNumber}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-orange-600">{formatCurrency(due)}</p>
                            <Badge
                              variant={bill.status === "PARTIALLY_PAID" ? "orange" : "info"}
                              className="text-[10px] mt-0.5"
                            >
                              {BILL_STATUS_LABELS[bill.status]}
                            </Badge>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                  {pendingBills.length > 5 && (
                    <Link href="/billing" className="block">
                      <p className="text-xs text-orange-500 hover:text-orange-700 text-center pt-2 transition-colors">
                        +{pendingBills.length - 5} more pending bills →
                      </p>
                    </Link>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="animate-fade-in grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Add Entry", desc: "Today's milk", href: "/daily-entry", color: "text-blue-600 bg-blue-50 hover:bg-blue-100 border-blue-200" },
            { label: "Customers", desc: "Manage", href: "/customers", color: "text-purple-600 bg-purple-50 hover:bg-purple-100 border-purple-200" },
            { label: "Generate Bills", desc: "This month", href: "/billing", color: "text-green-600 bg-green-50 hover:bg-green-100 border-green-200" },
            { label: "Reports", desc: "View analytics", href: "/reports", color: "text-orange-600 bg-orange-50 hover:bg-orange-100 border-orange-200" },
          ].map((action) => (
            <Link key={action.href} href={action.href}>
              <div className={`border rounded-xl p-3 text-center transition-all hover:shadow-sm hover:-translate-y-0.5 ${action.color}`}>
                <p className="font-semibold text-sm">{action.label}</p>
                <p className="text-xs opacity-70 mt-0.5">{action.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

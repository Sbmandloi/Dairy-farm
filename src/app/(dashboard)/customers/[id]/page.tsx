import { notFound } from "next/navigation";
import { getCustomerById, getCustomerPaymentHistory } from "@/lib/services/customer.service";
import { Header } from "@/components/layout/header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DeleteCustomerButton } from "@/components/customers/delete-customer-button";
import { RestoreCustomerButton } from "@/components/customers/restore-customer-button";
import Link from "next/link";
import { formatCurrency, formatDate, formatLiters, formatPeriod, decimalToNumber } from "@/lib/utils/format";
import { BILL_STATUS_LABELS, BILL_STATUS_COLORS } from "@/lib/constants";
import { Phone, MapPin, Calendar, IndianRupee, Edit, Droplets, Receipt, TrendingUp, Wallet, StickyNote, Archive, ArrowLeft, CheckCircle2 } from "lucide-react";

interface Props {
  params: Promise<{ id: string }>;
}

/** Generate a consistent avatar background color from a name */
function avatarColor(name: string) {
  const colors = [
    "bg-blue-500", "bg-emerald-500", "bg-violet-500",
    "bg-orange-500", "bg-rose-500", "bg-teal-500",
    "bg-indigo-500", "bg-amber-500",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export default async function CustomerDetailPage({ params }: Props) {
  const { id } = await params;
  const [customer, ledger] = await Promise.all([
    getCustomerById(id),
    getCustomerPaymentHistory(id),
  ]);
  if (!customer) notFound();

  const isArchived = customer.deletedAt !== null;

  const totalLiters = customer.dailyEntries.reduce(
    (s, e) => s + decimalToNumber(e.totalLiters), 0
  );
  // Account totals come from the ledger (all bills), not just the 12 shown below.
  const { totalBilled, totalPaid, totalPending: balance, payments, pendingByBill, unpaidBills } = ledger;
  const collectionPct = totalBilled > 0 ? Math.min(100, Math.round((totalPaid / totalBilled) * 100)) : 0;

  return (
    <div>
      <Header title={customer.name} />
      <div className="p-4 md:p-6 space-y-5">

        {/* Back link */}
        <Link
          href="/customers"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to customers
        </Link>

        {/* Archived banner */}
        {isArchived && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <div className="flex items-start gap-2 text-sm text-amber-800">
              <Archive className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <p>
                This customer is <strong>archived</strong>
                {customer.deletedAt && <> since {formatDate(customer.deletedAt)}</>}. Their data is
                kept in the database but hidden across the app. Restore to bring it back.
              </p>
            </div>
            <RestoreCustomerButton customerId={id} />
          </div>
        )}

        {/* Profile Hero Card */}
        <Card className="overflow-hidden">
          {/* Banner */}
          <div className={`h-24 relative ${isArchived ? "bg-gradient-to-r from-amber-500 via-amber-400 to-orange-300" : "bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-400"}`}>
            <div className="absolute inset-0 opacity-20"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
              }}
            />
            <div className="absolute right-4 top-4 opacity-20">
              <svg className="w-16 h-16 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C9.5 2 7.5 3.5 7 5.5C5.5 5.8 4 7.2 4 9C4 10.8 5.2 12.2 6.8 12.7L7 18H17L17.2 12.7C18.8 12.2 20 10.8 20 9C20 7.2 18.5 5.8 17 5.5C16.5 3.5 14.5 2 12 2ZM10 9C9.4 9 9 8.6 9 8C9 7.4 9.4 7 10 7C10.6 7 11 7.4 11 8C11 8.6 10.6 9 10 9ZM14 9C13.4 9 13 8.6 13 8C13 7.4 13.4 7 14 7C14.6 7 15 7.4 15 8C15 8.6 14.6 9 14 9ZM9 19H15L15.5 21H8.5L9 19Z"/>
              </svg>
            </div>
          </div>

          <CardContent className="pt-0 px-5 pb-5">
            {/* Avatar + actions row */}
            <div className="flex items-end justify-between -mt-8 mb-4">
              <div className={`w-16 h-16 rounded-2xl ${avatarColor(customer.name)} flex items-center justify-center shadow-lg border-4 border-white`}>
                <span className="text-xl font-bold text-white tracking-wide">
                  {getInitials(customer.name)}
                </span>
              </div>
              <div className="flex gap-2 pb-0.5">
                {isArchived ? (
                  <RestoreCustomerButton customerId={id} />
                ) : (
                  <>
                    <Link href={`/customers/${id}/edit`}>
                      <Button variant="outline" size="sm">
                        <Edit className="w-4 h-4" />
                        Edit
                      </Button>
                    </Link>
                    <DeleteCustomerButton customerId={id} customerName={customer.name} />
                  </>
                )}
              </div>
            </div>

            {/* Name + badges */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <h2 className="text-xl font-bold text-gray-900">{customer.name}</h2>
              {isArchived ? (
                <Badge variant="secondary" className="bg-amber-100 text-amber-700">Archived</Badge>
              ) : (
                <Badge variant={customer.isActive ? "success" : "secondary"}>
                  {customer.isActive ? "Active" : "Inactive"}
                </Badge>
              )}
              {customer.pricePerLiter && (
                <Badge variant="info" className="text-[10px]">
                  {formatCurrency(decimalToNumber(customer.pricePerLiter))}/L custom
                </Badge>
              )}
            </div>

            {/* Contact chips */}
            <div className="flex flex-wrap gap-2 mb-5">
              {customer.phoneNumber && <Chip icon={Phone}>{customer.phoneNumber}</Chip>}
              {customer.address && <Chip icon={MapPin}>{customer.address}</Chip>}
              <Chip icon={Calendar}>Since {formatDate(customer.startDate)}</Chip>
              <Chip icon={IndianRupee}>
                {customer.pricePerLiter
                  ? `${formatCurrency(decimalToNumber(customer.pricePerLiter))}/L`
                  : "Global rate"}
              </Chip>
            </div>

            {/* Collection progress */}
            {totalBilled > 0 && (
              <div className="mb-5">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-medium text-gray-600">Collection</span>
                  <span className="text-gray-500">
                    <span className="font-semibold text-green-600">{formatCurrency(totalPaid)}</span>
                    {" "}of {formatCurrency(totalBilled)}
                    {balance > 0.01 ? (
                      <span className="text-orange-500 font-medium"> · {formatCurrency(balance)} due</span>
                    ) : (
                      <span className="text-green-600 font-medium"> · fully paid</span>
                    )}
                  </span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${collectionPct >= 100 ? "bg-green-500" : "bg-gradient-to-r from-green-500 to-emerald-400"}`}
                    style={{ width: `${collectionPct}%` }}
                  />
                </div>
              </div>
            )}

            {/* KPI stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-gray-100">
              <Kpi icon={Droplets} tint="blue" value={`${totalLiters.toFixed(1)}L`} label="Total Liters" sub={`${customer.dailyEntries.length} deliveries`} />
              <Kpi icon={TrendingUp} tint="violet" value={formatCurrency(totalBilled)} label="Total Billed" />
              <Kpi icon={CheckCircle2} tint="green" value={formatCurrency(totalPaid)} label="Collected" />
              <Kpi
                icon={Receipt}
                tint={balance > 0.01 ? "orange" : "green"}
                value={formatCurrency(balance)}
                label={balance > 0.01 ? "Outstanding" : "All Clear"}
                valueClass={balance > 0.01 ? "text-orange-500" : "text-green-600"}
              />
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="bills">
          <TabsList>
            <TabsTrigger value="bills">Bills ({customer.bills.length})</TabsTrigger>
            <TabsTrigger value="payments">Payments ({payments.length})</TabsTrigger>
            <TabsTrigger value="entries">Entries ({customer.dailyEntries.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="bills" className="mt-4">
            {customer.bills.length === 0 ? (
              <EmptyState icon={Receipt} title="No bills generated yet">
                <Link href="/billing" className="mt-3 inline-block">
                  <Button variant="outline" size="sm">Go to Billing</Button>
                </Link>
              </EmptyState>
            ) : (
              <div className="space-y-2">
                {customer.bills.map((bill) => {
                  const paid = bill.payments.reduce((s, p) => s + decimalToNumber(p.amountPaid), 0);
                  const due = decimalToNumber(bill.totalAmount) - paid;
                  return (
                    <Link key={bill.id} href={`/billing/${bill.id}`} className="block">
                      <div className="flex items-center justify-between gap-3 p-4 bg-white border border-gray-200 rounded-xl hover:shadow-sm hover:border-blue-200 transition-all">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-gray-900 truncate">{bill.invoiceNumber}</p>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${BILL_STATUS_COLORS[bill.status]}`}>
                              {BILL_STATUS_LABELS[bill.status]}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">{formatPeriod(bill.periodStart, bill.periodEnd)}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-bold text-gray-900">{formatCurrency(decimalToNumber(bill.totalAmount))}</p>
                          {due > 0.01 ? (
                            <p className="text-xs text-orange-500">Due {formatCurrency(due)}</p>
                          ) : (
                            <p className="text-xs text-green-600">Paid</p>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="payments" className="mt-4 space-y-4">
            {payments.length === 0 ? (
              <EmptyState icon={Wallet} title="No payments recorded yet">
                {balance > 0 && (
                  <p className="text-xs mt-1 text-gray-400">
                    {formatCurrency(balance)} is outstanding across this customer&apos;s bills.
                  </p>
                )}
              </EmptyState>
            ) : (
              <>
                {/* Desktop: full ledger table */}
                <div className="hidden md:block bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left px-4 py-3 font-medium text-gray-600">Paid On</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-600">Invoice</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600">Bill Amount</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600">Amount Paid</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600">Pending</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-600">Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((p) => {
                        const pending = pendingByBill.get(p.bill.id) ?? 0;
                        return (
                          <tr key={p.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60">
                            <td className="px-4 py-2.5 text-gray-700 whitespace-nowrap">{formatDate(p.paidOn)}</td>
                            <td className="px-4 py-2.5">
                              <Link href={`/billing/${p.bill.id}`} className="text-blue-600 hover:underline font-medium">
                                {p.bill.invoiceNumber}
                              </Link>
                              <p className="text-xs text-gray-400">
                                {formatPeriod(p.bill.periodStart, p.bill.periodEnd)}
                              </p>
                            </td>
                            <td className="px-4 py-2.5 text-right text-gray-500">
                              {formatCurrency(p.bill.totalAmount)}
                            </td>
                            <td className="px-4 py-2.5 text-right font-semibold text-green-600">
                              {formatCurrency(p.amountPaid)}
                            </td>
                            <td className={`px-4 py-2.5 text-right font-medium ${pending > 0 ? "text-orange-500" : "text-gray-400"}`}>
                              {pending > 0 ? formatCurrency(pending) : "—"}
                            </td>
                            <td className="px-4 py-2.5 text-gray-500 max-w-[220px]">
                              {p.note ? (
                                <span className="line-clamp-2">{p.note}</span>
                              ) : (
                                <span className="text-gray-300">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 border-t border-gray-200 font-semibold text-gray-800">
                        <td className="px-4 py-3" colSpan={3}>Total</td>
                        <td className="px-4 py-3 text-right text-green-600">{formatCurrency(totalPaid)}</td>
                        <td className={`px-4 py-3 text-right ${balance > 0 ? "text-orange-500" : "text-gray-400"}`}>
                          {balance > 0 ? formatCurrency(balance) : "—"}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Mobile: card list */}
                <div className="md:hidden space-y-2">
                  {payments.map((p) => {
                    const pending = pendingByBill.get(p.bill.id) ?? 0;
                    return (
                      <div key={p.id} className="p-4 bg-white border border-gray-200 rounded-xl">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <Link href={`/billing/${p.bill.id}`} className="font-medium text-blue-600">
                              {p.bill.invoiceNumber}
                            </Link>
                            <p className="text-xs text-gray-400 mt-0.5">{formatDate(p.paidOn)}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="font-bold text-green-600">{formatCurrency(p.amountPaid)}</p>
                            {pending > 0 && (
                              <p className="text-xs text-orange-500">Pending: {formatCurrency(pending)}</p>
                            )}
                          </div>
                        </div>
                        {p.note && (
                          <p className="flex items-start gap-1.5 text-xs text-gray-500 mt-2 pt-2 border-t border-gray-100">
                            <StickyNote className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-px" />
                            {p.note}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="entries" className="mt-4">
            {customer.dailyEntries.length === 0 ? (
              <EmptyState icon={Droplets} title="No entries recorded" />
            ) : (
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Morning</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Evening</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customer.dailyEntries.map((e) => (
                      <tr key={e.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60">
                        <td className="px-4 py-2.5 text-gray-700">{formatDate(e.date)}</td>
                        <td className="px-4 py-2.5 text-right text-gray-500">
                          {e.morningLiters ? formatLiters(decimalToNumber(e.morningLiters)) : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-500">
                          {e.eveningLiters ? formatLiters(decimalToNumber(e.eveningLiters)) : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-right font-medium text-blue-600">
                          {formatLiters(decimalToNumber(e.totalLiters))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function Chip({ icon: Icon, children }: { icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-50 border border-gray-200 px-3 py-1 text-xs text-gray-600 max-w-full">
      <Icon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
      <span className="truncate">{children}</span>
    </span>
  );
}

const KPI_TINTS: Record<string, string> = {
  blue: "bg-blue-50 text-blue-500",
  violet: "bg-violet-50 text-violet-500",
  green: "bg-green-50 text-green-500",
  orange: "bg-orange-50 text-orange-500",
};

function Kpi({
  icon: Icon,
  tint,
  value,
  label,
  sub,
  valueClass,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tint: keyof typeof KPI_TINTS | string;
  value: string;
  label: string;
  sub?: string;
  valueClass?: string;
}) {
  return (
    <div className="text-center">
      <div className={`flex items-center justify-center w-8 h-8 rounded-full mx-auto mb-1 ${KPI_TINTS[tint] ?? KPI_TINTS.blue}`}>
        <Icon className="w-4 h-4" />
      </div>
      <p className={`text-base font-bold ${valueClass ?? "text-gray-800"}`}>{value}</p>
      <p className="text-xs text-gray-400">{label}</p>
      {sub && <p className="text-[10px] text-gray-400">{sub}</p>}
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="text-center py-14 text-gray-400 bg-white border border-dashed border-gray-200 rounded-xl">
      <Icon className="w-9 h-9 mx-auto mb-3 text-gray-300" />
      <p className="font-medium text-gray-500">{title}</p>
      {children}
    </div>
  );
}

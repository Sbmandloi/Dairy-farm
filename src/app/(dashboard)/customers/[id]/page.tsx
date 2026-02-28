import { notFound } from "next/navigation";
import { getCustomerById } from "@/lib/services/customer.service";
import { Header } from "@/components/layout/header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DeleteCustomerButton } from "@/components/customers/delete-customer-button";
import Link from "next/link";
import { formatCurrency, formatDate, formatLiters, formatPeriod, decimalToNumber } from "@/lib/utils/format";
import { BILL_STATUS_LABELS, BILL_STATUS_COLORS } from "@/lib/constants";
import { Phone, MapPin, Calendar, IndianRupee, Edit, Droplets, Receipt, TrendingUp } from "lucide-react";

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
  const customer = await getCustomerById(id);
  if (!customer) notFound();

  const totalLiters = customer.dailyEntries.reduce(
    (s, e) => s + decimalToNumber(e.totalLiters), 0
  );
  const totalBilled = customer.bills.reduce(
    (s, b) => s + decimalToNumber(b.totalAmount), 0
  );
  const totalPaid = customer.bills
    .flatMap((b) => b.payments)
    .reduce((s, p) => s + decimalToNumber(p.amountPaid), 0);
  const balance = totalBilled - totalPaid;

  return (
    <div>
      <Header title={customer.name} />
      <div className="p-4 md:p-6 space-y-5">

        {/* Profile Hero Card */}
        <Card className="overflow-hidden">
          {/* Banner */}
          <div className="h-24 bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-400 relative">
            <div className="absolute inset-0 opacity-20"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
              }}
            />
            {/* Dairy icon watermark */}
            <div className="absolute right-4 top-4 opacity-20">
              <svg className="w-16 h-16 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C9.5 2 7.5 3.5 7 5.5C5.5 5.8 4 7.2 4 9C4 10.8 5.2 12.2 6.8 12.7L7 18H17L17.2 12.7C18.8 12.2 20 10.8 20 9C20 7.2 18.5 5.8 17 5.5C16.5 3.5 14.5 2 12 2ZM10 9C9.4 9 9 8.6 9 8C9 7.4 9.4 7 10 7C10.6 7 11 7.4 11 8C11 8.6 10.6 9 10 9ZM14 9C13.4 9 13 8.6 13 8C13 7.4 13.4 7 14 7C14.6 7 15 7.4 15 8C15 8.6 14.6 9 14 9ZM9 19H15L15.5 21H8.5L9 19Z"/>
              </svg>
            </div>
          </div>

          <CardContent className="pt-0 px-5 pb-5">
            {/* Avatar + actions row */}
            <div className="flex items-end justify-between -mt-8 mb-4">
              {/* Avatar */}
              <div className={`w-16 h-16 rounded-2xl ${avatarColor(customer.name)} flex items-center justify-center shadow-lg border-4 border-white`}>
                <span className="text-xl font-bold text-white tracking-wide">
                  {getInitials(customer.name)}
                </span>
              </div>
              {/* Action buttons */}
              <div className="flex gap-2 pb-0.5">
                <Link href={`/customers/${id}/edit`}>
                  <Button variant="outline" size="sm">
                    <Edit className="w-4 h-4" />
                    Edit
                  </Button>
                </Link>
                <DeleteCustomerButton customerId={id} customerName={customer.name} />
              </div>
            </div>

            {/* Name + badge */}
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-xl font-bold text-gray-900">{customer.name}</h2>
              <Badge variant={customer.isActive ? "success" : "secondary"}>
                {customer.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>

            {/* Contact info */}
            <div className="grid sm:grid-cols-2 gap-1.5 text-sm text-gray-500 mb-4">
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                {customer.phoneNumber}
              </div>
              {customer.address && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  {customer.address}
                </div>
              )}
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                Customer since {formatDate(customer.startDate)}
              </div>
              <div className="flex items-center gap-2">
                <IndianRupee className="w-4 h-4 text-gray-400 flex-shrink-0" />
                {customer.pricePerLiter
                  ? `${formatCurrency(decimalToNumber(customer.pricePerLiter))}/L (custom price)`
                  : "Using global rate"}
              </div>
            </div>

            {/* Stats strip */}
            <div className="grid grid-cols-3 gap-3 pt-4 border-t border-gray-100">
              <div className="text-center">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-50 mx-auto mb-1">
                  <Droplets className="w-4 h-4 text-blue-500" />
                </div>
                <p className="text-base font-bold text-blue-600">{totalLiters.toFixed(1)}L</p>
                <p className="text-xs text-gray-400">Total Liters</p>
              </div>
              <div className="text-center border-x border-gray-100">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-50 mx-auto mb-1">
                  <TrendingUp className="w-4 h-4 text-green-500" />
                </div>
                <p className="text-base font-bold text-gray-800">{formatCurrency(totalBilled)}</p>
                <p className="text-xs text-gray-400">Total Billed</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-50 mx-auto mb-1">
                  <Receipt className="w-4 h-4 text-orange-500" />
                </div>
                <p className={`text-base font-bold ${balance > 0 ? "text-orange-500" : "text-green-600"}`}>
                  {formatCurrency(balance)}
                </p>
                <p className="text-xs text-gray-400">{balance > 0 ? "Outstanding" : "All Clear"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="bills">
          <TabsList>
            <TabsTrigger value="bills">Bills ({customer.bills.length})</TabsTrigger>
            <TabsTrigger value="entries">Recent Entries</TabsTrigger>
          </TabsList>

          <TabsContent value="bills" className="mt-4">
            {customer.bills.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <p>No bills generated yet</p>
                <Link href="/billing" className="mt-2 inline-block">
                  <Button variant="outline" size="sm">Go to Billing</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {customer.bills.map((bill) => {
                  const paid = bill.payments.reduce((s, p) => s + decimalToNumber(p.amountPaid), 0);
                  const due = decimalToNumber(bill.totalAmount) - paid;
                  return (
                    <Link key={bill.id} href={`/billing/${bill.id}`}>
                      <div className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-all">
                        <div>
                          <p className="font-medium text-gray-900">{bill.invoiceNumber}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{formatPeriod(bill.periodStart, bill.periodEnd)}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-gray-900">{formatCurrency(decimalToNumber(bill.totalAmount))}</p>
                          {due > 0 && <p className="text-xs text-orange-500">Due: {formatCurrency(due)}</p>}
                          <span className={`text-xs px-2 py-0.5 rounded-full ${BILL_STATUS_COLORS[bill.status]}`}>
                            {BILL_STATUS_LABELS[bill.status]}
                          </span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="entries" className="mt-4">
            {customer.dailyEntries.length === 0 ? (
              <div className="text-center py-12 text-gray-400">No entries recorded</div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
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
                      <tr key={e.id} className="border-b border-gray-100 last:border-0">
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

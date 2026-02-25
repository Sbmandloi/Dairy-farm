import { notFound } from "next/navigation";
import { getCustomerById } from "@/lib/services/customer.service";
import { Header } from "@/components/layout/header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import { formatCurrency, formatDate, formatLiters, formatPeriod, decimalToNumber } from "@/lib/utils/format";
import { BILL_STATUS_LABELS, BILL_STATUS_COLORS } from "@/lib/constants";
import { Phone, MapPin, Calendar, IndianRupee, Edit } from "lucide-react";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CustomerDetailPage({ params }: Props) {
  const { id } = await params;
  const customer = await getCustomerById(id);
  if (!customer) notFound();

  return (
    <div>
      <Header title={customer.name} />
      <div className="p-4 md:p-6 space-y-6">
        {/* Profile Card */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-gray-900">{customer.name}</h2>
                  <Badge variant={customer.isActive ? "success" : "secondary"}>
                    {customer.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <div className="space-y-1 text-sm text-gray-500">
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    {customer.phoneNumber}
                  </div>
                  {customer.address && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      {customer.address}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Customer since {formatDate(customer.startDate)}
                  </div>
                  <div className="flex items-center gap-2">
                    <IndianRupee className="w-4 h-4" />
                    {customer.pricePerLiter
                      ? `${formatCurrency(decimalToNumber(customer.pricePerLiter))}/L (custom price)`
                      : "Using global rate"}
                  </div>
                </div>
              </div>
              <Link href={`/customers/${id}/edit`}>
                <Button variant="outline" size="sm">
                  <Edit className="w-4 h-4" />
                  Edit
                </Button>
              </Link>
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

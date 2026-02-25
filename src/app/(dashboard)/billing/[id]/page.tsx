import { notFound } from "next/navigation";
import { getBillById } from "@/lib/services/billing.service";
import { getEntriesForPeriod } from "@/lib/services/daily-entry.service";
import { Header } from "@/components/layout/header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SendWhatsAppButton } from "@/components/billing/send-whatsapp-button";
import { MarkPaidDialog } from "@/components/billing/mark-paid-dialog";
import { formatCurrency, formatDate, formatLiters, formatPeriod, decimalToNumber } from "@/lib/utils/format";
import { BILL_STATUS_LABELS, BILL_STATUS_COLORS } from "@/lib/constants";
import Link from "next/link";
import { Download, ArrowLeft, Phone, MapPin } from "lucide-react";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function BillDetailPage({ params }: Props) {
  const { id } = await params;
  const bill = await getBillById(id);
  if (!bill) notFound();

  const entries = await getEntriesForPeriod(bill.customerId, bill.periodStart, bill.periodEnd);
  const paid = bill.payments.reduce((s, p) => s + decimalToNumber(p.amountPaid), 0);
  const due = decimalToNumber(bill.totalAmount) - paid;

  return (
    <div>
      <Header title={bill.invoiceNumber} />
      <div className="p-4 md:p-6 space-y-5">
        <div className="flex items-center gap-3">
          <Link href="/billing">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4" />
              Back to Billing
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Invoice info */}
          <div className="lg:col-span-2 space-y-4">
            {/* Header card */}
            <Card>
              <CardContent className="p-5">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{bill.invoiceNumber}</h2>
                    <p className="text-sm text-gray-500 mt-1">
                      Period: {formatPeriod(bill.periodStart, bill.periodEnd)}
                    </p>
                    <p className="text-sm text-gray-500">Generated: {formatDate(bill.createdAt)}</p>
                    {bill.sentAt && <p className="text-sm text-gray-500">Sent: {formatDate(bill.sentAt)}</p>}
                  </div>
                  <Badge className={`${BILL_STATUS_COLORS[bill.status]} text-sm`}>
                    {BILL_STATUS_LABELS[bill.status]}
                  </Badge>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Customer</p>
                  <p className="font-semibold text-gray-900">{bill.customer.name}</p>
                  <div className="flex items-center gap-1.5 text-sm text-gray-500 mt-1">
                    <Phone className="w-3.5 h-3.5" />
                    {bill.customer.phoneNumber}
                  </div>
                  {bill.customer.address && (
                    <div className="flex items-center gap-1.5 text-sm text-gray-500 mt-0.5">
                      <MapPin className="w-3.5 h-3.5" />
                      {bill.customer.address}
                    </div>
                  )}
                </div>

                <div className="mt-4 flex gap-2">
                  <a href={`/api/billing/${id}/pdf`} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm">
                      <Download className="w-4 h-4" />
                      Download PDF
                    </Button>
                  </a>
                  <SendWhatsAppButton billId={id} />
                  {due > 0 && <MarkPaidDialog billId={id} remainingAmount={due} />}
                </div>
              </CardContent>
            </Card>

            {/* Daily entries */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Daily Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
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
                      {entries.map((e) => (
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
                      {entries.length === 0 && (
                        <tr>
                          <td colSpan={4} className="text-center py-6 text-gray-400">No entries for this period</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Summary sidebar */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Invoice Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Total Liters</span>
                  <span className="font-medium">{formatLiters(decimalToNumber(bill.totalLiters))}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Price / Liter</span>
                  <span className="font-medium">{formatCurrency(decimalToNumber(bill.pricePerLiter))}</span>
                </div>
                <div className="flex justify-between font-bold text-base border-t border-gray-200 pt-3">
                  <span>Total Amount</span>
                  <span className="text-blue-600">{formatCurrency(decimalToNumber(bill.totalAmount))}</span>
                </div>
                {paid > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Amount Paid</span>
                    <span>-{formatCurrency(paid)}</span>
                  </div>
                )}
                {due > 0 && (
                  <div className="flex justify-between font-semibold text-orange-600 border-t border-gray-100 pt-2">
                    <span>Balance Due</span>
                    <span>{formatCurrency(due)}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Payment history */}
            {bill.payments.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Payment History</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {bill.payments.map((p) => (
                    <div key={p.id} className="flex justify-between text-sm border-b border-gray-50 pb-2 last:border-0">
                      <div>
                        <p className="font-medium text-gray-700">{formatCurrency(decimalToNumber(p.amountPaid))}</p>
                        <p className="text-xs text-gray-400">{p.note || "Payment"}</p>
                      </div>
                      <p className="text-xs text-gray-500">{formatDate(p.paidOn)}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

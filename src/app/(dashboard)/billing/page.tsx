import { getCustomersWithBillsForPeriod } from "@/lib/services/billing.service";
import { Header } from "@/components/layout/header";
import { Badge } from "@/components/ui/badge";
import { DateRangePicker } from "@/components/billing/date-range-picker";
import { BillingControls } from "@/components/billing/billing-controls";
import { SendWhatsAppButton } from "@/components/billing/send-whatsapp-button";
import { MarkPaidDialog } from "@/components/billing/mark-paid-dialog";
import { GenerateCustomerBillButton } from "@/components/billing/generate-customer-bill-button";
import { formatCurrency, formatLiters, decimalToNumber } from "@/lib/utils/format";
import { BILL_STATUS_LABELS, BILL_STATUS_COLORS } from "@/lib/constants";
import Link from "next/link";
import { Users } from "lucide-react";

interface PageProps {
  searchParams: Promise<{ from?: string; to?: string }>;
}

function defaultRange() {
  const d = new Date();
  const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  // last day of current month
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const to = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`;
  return { from, to };
}

export default async function BillingPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const def = defaultRange();
  const fromStr = params.from || def.from;
  const toStr = params.to || def.to;

  const periodStart = new Date(fromStr);
  const periodEnd = new Date(toStr);

  const rows = await getCustomersWithBillsForPeriod(periodStart, periodEnd);

  // Compute summary totals from existing bills
  const billRows = rows.filter((r) => r.bill !== null);
  const totalAmount = billRows.reduce((s, r) => s + decimalToNumber(r.bill!.totalAmount), 0);
  const totalLiters = billRows.reduce((s, r) => s + decimalToNumber(r.bill!.totalLiters), 0);
  const totalPaid = billRows.reduce(
    (s, r) => s + r.bill!.payments.reduce((ps, p) => ps + decimalToNumber(p.amountPaid), 0),
    0
  );

  const periodLabel =
    fromStr === toStr
      ? new Date(fromStr).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
      : `${new Date(fromStr).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} — ${new Date(toStr).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`;

  return (
    <div>
      <Header title="Billing" />
      <div className="p-4 md:p-6 space-y-5">

        {/* Date range selector + Generate All / Send All */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4 shadow-sm">
          <div className="flex flex-col gap-1">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Billing Period</p>
            <p className="text-sm font-medium text-gray-700">{periodLabel}</p>
          </div>
          <DateRangePicker from={fromStr} to={toStr} />
          <div className="pt-1 border-t border-gray-100">
            <BillingControls periodStart={fromStr} periodEnd={toStr} billCount={billRows.length} />
          </div>
        </div>

        {/* Summary bar */}
        {billRows.length > 0 && (
          <div className="grid grid-cols-3 gap-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
            <div className="text-center">
              <p className="text-xs text-blue-600 font-medium">Total Liters</p>
              <p className="text-lg font-bold text-blue-800">{formatLiters(totalLiters)}</p>
            </div>
            <div className="text-center border-x border-blue-200">
              <p className="text-xs text-blue-600 font-medium">Total Billed</p>
              <p className="text-lg font-bold text-blue-800">{formatCurrency(totalAmount)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-blue-600 font-medium">Outstanding</p>
              <p className="text-lg font-bold text-orange-600">{formatCurrency(totalAmount - totalPaid)}</p>
            </div>
          </div>
        )}

        {/* Customer billing list */}
        {rows.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No active customers found</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            {/* Table header (desktop) */}
            <div className="hidden md:grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-4 px-4 py-3 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase tracking-wide">
              <div>Customer</div>
              <div className="text-right">Liters</div>
              <div className="text-right">Amount</div>
              <div className="text-center">Status</div>
              <div className="text-center">Period</div>
              <div className="text-center">Actions</div>
            </div>

            {rows.map(({ customer, bill }) => {
              const paid = bill
                ? bill.payments.reduce((s, p) => s + decimalToNumber(p.amountPaid), 0)
                : 0;
              const due = bill ? decimalToNumber(bill.totalAmount) - paid : 0;

              return (
                <div
                  key={customer.id}
                  className="border-b border-gray-100 last:border-0 p-4 hover:bg-gray-50 transition-colors"
                >
                  {/* Mobile layout */}
                  <div className="md:hidden space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-gray-900">{customer.name}</p>
                        {customer.address && (
                          <p className="text-xs text-gray-400 mt-0.5">{customer.address}</p>
                        )}
                        {bill && (
                          <p className="text-xs text-gray-400">{bill.invoiceNumber}</p>
                        )}
                      </div>
                      {bill ? (
                        <Badge className={BILL_STATUS_COLORS[bill.status]}>
                          {BILL_STATUS_LABELS[bill.status]}
                        </Badge>
                      ) : (
                        <Badge className="bg-gray-100 text-gray-500">No Bill</Badge>
                      )}
                    </div>

                    {bill ? (
                      <>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">
                            {formatLiters(decimalToNumber(bill.totalLiters))} ×{" "}
                            {formatCurrency(decimalToNumber(bill.pricePerLiter))}
                          </span>
                          <span className="font-bold">{formatCurrency(decimalToNumber(bill.totalAmount))}</span>
                        </div>
                        {due > 0 && <p className="text-xs text-orange-500">Due: {formatCurrency(due)}</p>}
                        <div className="flex flex-wrap gap-2">
                          <Link href={`/billing/${bill.id}`}>
                            <button className="text-xs text-blue-600 hover:underline">View</button>
                          </Link>
                          <SendWhatsAppButton billId={bill.id} />
                          {due > 0 && <MarkPaidDialog billId={bill.id} remainingAmount={due} />}
                          <GenerateCustomerBillButton
                            customerId={customer.id}
                            periodStart={fromStr}
                            periodEnd={toStr}
                            hasBill
                          />
                        </div>
                      </>
                    ) : (
                      <GenerateCustomerBillButton
                        customerId={customer.id}
                        periodStart={fromStr}
                        periodEnd={toStr}
                      />
                    )}
                  </div>

                  {/* Desktop layout */}
                  <div className="hidden md:grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-4 items-center">
                    {/* Customer info */}
                    <div>
                      {bill ? (
                        <Link href={`/billing/${bill.id}`} className="font-medium text-gray-900 hover:text-blue-600">
                          {customer.name}
                        </Link>
                      ) : (
                        <p className="font-medium text-gray-900">{customer.name}</p>
                      )}
                      {customer.address && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{customer.address}</p>
                      )}
                      {bill && <p className="text-xs text-gray-400">{bill.invoiceNumber}</p>}
                    </div>

                    {/* Liters */}
                    <div className="text-right text-sm text-gray-700">
                      {bill ? formatLiters(decimalToNumber(bill.totalLiters)) : <span className="text-gray-300">—</span>}
                    </div>

                    {/* Amount */}
                    <div className="text-right">
                      {bill ? (
                        <>
                          <p className="font-bold text-gray-900">{formatCurrency(decimalToNumber(bill.totalAmount))}</p>
                          {due > 0 && <p className="text-xs text-orange-500">Due: {formatCurrency(due)}</p>}
                        </>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </div>

                    {/* Status */}
                    <div className="text-center">
                      {bill ? (
                        <Badge className={BILL_STATUS_COLORS[bill.status]}>
                          {BILL_STATUS_LABELS[bill.status]}
                        </Badge>
                      ) : (
                        <Badge className="bg-gray-100 text-gray-500 text-xs">No Bill</Badge>
                      )}
                    </div>

                    {/* Period */}
                    <div className="text-center text-xs text-gray-500 whitespace-nowrap">
                      {bill ? (
                        <>
                          <p>{new Date(bill.periodStart).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</p>
                          <p>{new Date(bill.periodEnd).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
                        </>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 justify-end">
                      {bill && (
                        <>
                          <Link href={`/billing/${bill.id}`}>
                            <button className="text-xs text-blue-600 hover:underline">Details</button>
                          </Link>
                          <SendWhatsAppButton billId={bill.id} />
                          {due > 0 && <MarkPaidDialog billId={bill.id} remainingAmount={due} />}
                        </>
                      )}
                      <GenerateCustomerBillButton
                        customerId={customer.id}
                        periodStart={fromStr}
                        periodEnd={toStr}
                        hasBill={bill !== null}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

import { getCustomersWithBillsForPeriod } from "@/lib/services/billing.service";
import { Header } from "@/components/layout/header";
import { AutoRefresh } from "@/components/dashboard/auto-refresh";
import { MonthPicker } from "@/components/billing/month-picker";
import { BillingControls } from "@/components/billing/billing-controls";
import { BillingListWithSearch } from "@/components/billing/billing-list-with-search";
import { formatCurrency, formatLiters, decimalToNumber } from "@/lib/utils/format";
import { currentYearMonth, monthPeriod, parseDateOnly } from "@/lib/utils/date";
import { Droplets, IndianRupee, CheckCircle2, AlertCircle } from "lucide-react";

// Bills change as they're generated / paid / sent — always render fresh.
export const dynamic = "force-dynamic";

interface PageProps {
  // Billing is always a whole month (1st → last day), so the period is a
  // year/month, not an arbitrary date range.
  searchParams: Promise<{ year?: string; month?: string }>;
}

export default async function BillingPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const now = currentYearMonth();
  const year = Number(params.year) || now.year;
  const month = Number(params.month) || now.month;

  const { start: fromStr, end: toStr } = monthPeriod(year, month);

  const rows = await getCustomersWithBillsForPeriod(
    parseDateOnly(fromStr),
    parseDateOnly(toStr)
  );
  const generatedAt = Date.now();

  const billRows = rows.filter((r) => r.bill !== null);
  const totalAmount = billRows.reduce((s, r) => s + decimalToNumber(r.bill!.totalAmount), 0);
  const totalLiters = billRows.reduce((s, r) => s + decimalToNumber(r.bill!.totalLiters), 0);
  const totalPaid = billRows.reduce(
    (s, r) => s + r.bill!.payments.reduce((ps, p) => ps + decimalToNumber(p.amountPaid), 0),
    0
  );
  const outstanding = totalAmount - totalPaid;
  const withoutBill = rows.length - billRows.length;
  const sendable = billRows.filter(
    (r) => r.customer.phoneNumber && r.bill!.status !== "PAID"
  ).length;

  // Serialize Prisma Decimal/Date → plain values for the client component
  const serializedRows = rows.map(({ customer, bill }) => {
    const paid = bill
      ? bill.payments.reduce((s, p) => s + decimalToNumber(p.amountPaid), 0)
      : 0;
    return {
      customer: {
        id: customer.id,
        name: customer.name,
        address: customer.address,
        phoneNumber: customer.phoneNumber,
      },
      bill: bill
        ? {
            id: bill.id,
            invoiceNumber: bill.invoiceNumber,
            totalLiters: decimalToNumber(bill.totalLiters),
            totalAmount: decimalToNumber(bill.totalAmount),
            pricePerLiter: decimalToNumber(bill.pricePerLiter),
            status: bill.status,
            periodStart: bill.periodStart.toISOString(),
            periodEnd: bill.periodEnd.toISOString(),
            paid,
            due: decimalToNumber(bill.totalAmount) - paid,
          }
        : null,
    };
  });

  const stats = [
    {
      label: "Total Quantity",
      value: formatLiters(totalLiters),
      sub: `${billRows.length} bill${billRows.length === 1 ? "" : "s"}`,
      icon: Droplets,
      tint: "bg-blue-50 border-blue-100 text-blue-500",
    },
    {
      label: "Total Billed",
      value: formatCurrency(totalAmount),
      sub: "for this month",
      icon: IndianRupee,
      tint: "bg-violet-50 border-violet-100 text-violet-500",
    },
    {
      label: "Collected",
      value: formatCurrency(totalPaid),
      sub: "payments received",
      icon: CheckCircle2,
      tint: "bg-green-50 border-green-100 text-green-500",
    },
    {
      label: "Outstanding",
      value: formatCurrency(outstanding),
      sub: outstanding > 0.01 ? "still to collect" : "all settled",
      icon: AlertCircle,
      tint:
        outstanding > 0.01
          ? "bg-orange-50 border-orange-100 text-orange-500"
          : "bg-green-50 border-green-100 text-green-500",
    },
  ];

  return (
    <div>
      <Header title="Billing" actions={<AutoRefresh generatedAt={generatedAt} />} />

      <div className="p-4 md:p-6 space-y-5">
        {/* Period + bulk actions */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Billing Period
              </p>
              <p className="text-sm text-gray-400 mt-0.5">
                Always the 1st to the last day of the month
              </p>
            </div>
            <MonthPicker year={year} month={month} />
          </div>

          <div className="pt-3 border-t border-gray-100">
            <BillingControls
              periodStart={fromStr}
              periodEnd={toStr}
              billCount={billRows.length}
              customerCount={rows.length}
              withoutBill={withoutBill}
              sendableCount={sendable}
              year={year}
              month={month}
            />
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {stats.map((s) => (
            <div key={s.label} className={`border rounded-xl p-3.5 flex items-center gap-3 ${s.tint}`}>
              <div className="w-9 h-9 rounded-lg bg-white/70 grid place-items-center flex-shrink-0">
                <s.icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-gray-500 uppercase tracking-wide truncate">{s.label}</p>
                <p className="font-bold text-gray-900 truncate">{s.value}</p>
                <p className="text-[11px] text-gray-400 truncate">{s.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Customer billing list */}
        <BillingListWithSearch rows={serializedRows} periodStart={fromStr} periodEnd={toStr} />
      </div>
    </div>
  );
}

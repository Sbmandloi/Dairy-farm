import { getCustomersWithBillsForPeriod } from "@/lib/services/billing.service";
import { Header } from "@/components/layout/header";
import { DateRangePicker } from "@/components/billing/date-range-picker";
import { BillingControls } from "@/components/billing/billing-controls";
import { BillingListWithSearch } from "@/components/billing/billing-list-with-search";
import { formatCurrency, formatLiters, decimalToNumber } from "@/lib/utils/format";

interface PageProps {
  searchParams: Promise<{ from?: string; to?: string }>;
}

function defaultRange() {
  const d = new Date();
  const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
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

  // Compute summary totals
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

  // Serialize Prisma Decimal/Date → plain numbers/strings for client component
  const serializedRows = rows.map(({ customer, bill }) => {
    const paid = bill
      ? bill.payments.reduce((s, p) => s + decimalToNumber(p.amountPaid), 0)
      : 0;
    return {
      customer: {
        id: customer.id,
        name: customer.name,
        address: customer.address,
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
            due: decimalToNumber(bill.totalAmount) - paid,
          }
        : null,
    };
  });

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

        {/* Customer billing list with search */}
        <BillingListWithSearch
          rows={serializedRows}
          periodStart={fromStr}
          periodEnd={toStr}
        />
      </div>
    </div>
  );
}

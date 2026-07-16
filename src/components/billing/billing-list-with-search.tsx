"use client";

import { useState } from "react";
import { SearchBar } from "@/components/ui/search-bar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { MarkPaidDialog } from "./mark-paid-dialog";
import { GenerateCustomerBillButton } from "./generate-customer-bill-button";
import { BillPreviewDialog } from "./bill-preview-dialog";
import { BILL_STATUS_LABELS, BILL_STATUS_COLORS } from "@/lib/constants";
import { formatCurrency, formatLiters, formatDate } from "@/lib/utils/format";
import { Users } from "lucide-react";

// ─── Serializable types (no Prisma Decimals) ────────────────────────────────

export interface SerializedBillRow {
  customer: {
    id: string;
    name: string;
    address: string | null;
    phoneNumber: string | null;
  };
  bill: {
    id: string;
    invoiceNumber: string;
    totalLiters: number;
    totalAmount: number;
    pricePerLiter: number;
    status: string;
    periodStart: string;
    periodEnd: string;
    paid: number;
    due: number;
  } | null;
}

interface Props {
  rows: SerializedBillRow[];
  periodStart: string;
  periodEnd: string;
}

type StatusFilter = "all" | "bill" | "no-bill" | "paid" | "unpaid";

const STATUS_TABS: { label: string; value: StatusFilter }[] = [
  { label: "All", value: "all" },
  { label: "Has Bill", value: "bill" },
  { label: "No Bill", value: "no-bill" },
  { label: "Paid", value: "paid" },
  { label: "Unpaid", value: "unpaid" },
];

export function BillingListWithSearch({ rows, periodStart, periodEnd }: Props) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filtered = rows.filter((r) => {
    // Name search
    if (query && !r.customer.name.toLowerCase().includes(query.toLowerCase())) {
      return false;
    }
    // Status filter
    if (statusFilter === "bill" && !r.bill) return false;
    if (statusFilter === "no-bill" && r.bill) return false;
    if (statusFilter === "paid" && r.bill?.status !== "PAID") return false;
    if (statusFilter === "unpaid" && (!r.bill || r.bill.status === "PAID")) return false;
    return true;
  });

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <SearchBar
        placeholder="Search customer by name…"
        onSearch={setQuery}
        className="max-w-md"
      />

      {/* Status filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_TABS.map((tab) => (
          <Button
            key={tab.value}
            size="sm"
            variant={statusFilter === tab.value ? "default" : "outline"}
            onClick={() => setStatusFilter(tab.value)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Result count */}
      {(query || statusFilter !== "all") && (
        <p className="text-xs text-gray-500">
          Showing {filtered.length} of {rows.length} customers
          {query && (
            <>
              {" "}matching &ldquo;{query}&rdquo;
            </>
          )}
        </p>
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No customers match your search</p>
          <button
            onClick={() => { setQuery(""); setStatusFilter("all"); }}
            className="text-sm text-blue-600 mt-1 hover:underline"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          {/* Desktop header */}
          <div className="hidden md:grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-4 px-4 py-3 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase tracking-wide">
            <div>Customer</div>
            <div className="text-right">Liters</div>
            <div className="text-right">Amount</div>
            <div className="text-center">Status</div>
            <div className="text-center">Period</div>
            <div className="text-center">Actions</div>
          </div>

          {filtered.map(({ customer, bill }) => (
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
                    {bill && <p className="text-xs text-gray-400">{bill.invoiceNumber}</p>}
                  </div>
                  {bill ? (
                    <Badge className={BILL_STATUS_COLORS[bill.status as keyof typeof BILL_STATUS_COLORS]}>
                      {BILL_STATUS_LABELS[bill.status as keyof typeof BILL_STATUS_LABELS]}
                    </Badge>
                  ) : (
                    <Badge className="bg-gray-100 text-gray-500">No Bill</Badge>
                  )}
                </div>
                {bill ? (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">
                        {formatLiters(bill.totalLiters)} × {formatCurrency(bill.pricePerLiter)}
                      </span>
                      <span className="font-bold">{formatCurrency(bill.totalAmount)}</span>
                    </div>
                    {bill.due > 0 && (
                      <p className="text-xs text-orange-500">Due: {formatCurrency(bill.due)}</p>
                    )}
                    {bill.paid > 0 && (
                      <p className="text-xs text-green-600">Paid: {formatCurrency(bill.paid)}</p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Link href={`/billing/${bill.id}`}>
                        <button className="text-xs text-blue-600 hover:underline">View</button>
                      </Link>
                      <BillPreviewDialog
                        billId={bill.id}
                        invoiceNumber={bill.invoiceNumber}
                        customerName={customer.name}
                        canSend={!!customer.phoneNumber}
                        triggerLabel="Preview & Send"
                      />
                      {bill.due > 0 && (
                        <MarkPaidDialog billId={bill.id} remainingAmount={bill.due} />
                      )}
                      <GenerateCustomerBillButton
                        customerId={customer.id}
                        periodStart={periodStart}
                        periodEnd={periodEnd}
                        hasBill
                      />
                    </div>
                  </>
                ) : (
                  <GenerateCustomerBillButton
                    customerId={customer.id}
                    periodStart={periodStart}
                    periodEnd={periodEnd}
                  />
                )}
              </div>

              {/* Desktop layout */}
              <div className="hidden md:grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-4 items-center">
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
                <div className="text-right text-sm text-gray-700">
                  {bill ? formatLiters(bill.totalLiters) : <span className="text-gray-300">—</span>}
                </div>
                <div className="text-right">
                  {bill ? (
                    <>
                      <p className="font-bold text-gray-900">{formatCurrency(bill.totalAmount)}</p>
                      {bill.paid > 0 && (
                        <p className="text-xs text-green-600">Paid: {formatCurrency(bill.paid)}</p>
                      )}
                      {bill.due > 0 && (
                        <p className="text-xs text-orange-500">Due: {formatCurrency(bill.due)}</p>
                      )}
                    </>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </div>
                <div className="text-center">
                  {bill ? (
                    <Badge className={BILL_STATUS_COLORS[bill.status as keyof typeof BILL_STATUS_COLORS]}>
                      {BILL_STATUS_LABELS[bill.status as keyof typeof BILL_STATUS_LABELS]}
                    </Badge>
                  ) : (
                    <Badge className="bg-gray-100 text-gray-500 text-xs">No Bill</Badge>
                  )}
                </div>
                <div className="text-center text-xs text-gray-500 whitespace-nowrap">
                  {bill ? (
                    <>
                      {/* formatDate is UTC-pinned — toLocaleDateString here rendered
                          the period a day early west of UTC ("30 Jun" for Jul 1). */}
                      <p>{formatDate(bill.periodStart)}</p>
                      <p>{formatDate(bill.periodEnd)}</p>
                    </>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </div>
                <div className="flex items-center gap-2 justify-end">
                  {bill && (
                    <>
                      <Link href={`/billing/${bill.id}`}>
                        <button className="text-xs text-blue-600 hover:underline">Details</button>
                      </Link>
                      <BillPreviewDialog
                        billId={bill.id}
                        invoiceNumber={bill.invoiceNumber}
                        customerName={customer.name}
                        canSend={!!customer.phoneNumber}
                      />
                      {bill.due > 0 && (
                        <MarkPaidDialog billId={bill.id} remainingAmount={bill.due} />
                      )}
                    </>
                  )}
                  <GenerateCustomerBillButton
                    customerId={customer.id}
                    periodStart={periodStart}
                    periodEnd={periodEnd}
                    hasBill={bill !== null}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

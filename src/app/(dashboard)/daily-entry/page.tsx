import { getDailyEntriesWithCustomers } from "@/lib/services/daily-entry.service";
import { getSettings } from "@/lib/services/settings.service";
import { Header } from "@/components/layout/header";
import { EntryGrid } from "@/components/daily-entry/entry-grid";
import { DateNavigator } from "@/components/daily-entry/date-navigator";
import { formatLiters, formatCurrency, decimalToNumber } from "@/lib/utils/format";
import { parseDateOnly, todayInAppTz } from "@/lib/utils/date";
import { Card, CardContent } from "@/components/ui/card";
import { Milk, Users, IndianRupee } from "lucide-react";

// The summary cards must reflect the latest saved entries immediately.
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ date?: string }>;
}

export default async function DailyEntryPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const dateStr = params.date || todayInAppTz();
  const date = parseDateOnly(dateStr);

  const [rows, settings] = await Promise.all([
    getDailyEntriesWithCustomers(date),
    getSettings(),
  ]);

  const globalPrice = decimalToNumber(settings.globalPricePerLiter);

  // Compute the summary from the same rows, using each customer's effective
  // price (custom, else global) so revenue matches what bills will produce.
  let totalLiters = 0;
  let estimatedRevenue = 0;
  let customerCount = 0;
  for (const { customer, entry } of rows) {
    if (!entry) continue;
    const liters = entry.totalLiters != null ? decimalToNumber(entry.totalLiters) : 0;
    if (liters <= 0) continue;
    customerCount++;
    totalLiters += liters;
    const price = customer.pricePerLiter != null ? decimalToNumber(customer.pricePerLiter) : globalPrice;
    estimatedRevenue += liters * price;
  }

  return (
    <div>
      <Header title="Daily Entry" />
      <div className="p-4 md:p-6 space-y-4">
        {/* Date picker */}
        <DateNavigator currentDate={dateStr} />

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-3 text-center">
              <Milk className="w-4 h-4 text-blue-500 mx-auto mb-1" />
              <p className="text-xs text-gray-500">Total Milk</p>
              <p className="font-bold text-blue-600">{formatLiters(totalLiters)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <Users className="w-4 h-4 text-purple-500 mx-auto mb-1" />
              <p className="text-xs text-gray-500">Customers</p>
              <p className="font-bold text-purple-600">{customerCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <IndianRupee className="w-4 h-4 text-green-500 mx-auto mb-1" />
              <p className="text-xs text-gray-500">Est. Revenue</p>
              <p className="font-bold text-green-600">{formatCurrency(estimatedRevenue)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Entry Grid — serialize Prisma Decimal/Date to plain JS types.
            key={dateStr} forces a fresh mount per day so the grid always shows
            THAT day's saved entries, never stale state from a previous day. */}
        <EntryGrid
          key={dateStr}
          date={dateStr}
          rows={rows.map(({ customer, entry }) => ({
            customer: {
              id: customer.id,
              name: customer.name,
              phoneNumber: customer.phoneNumber,
              address: customer.address,
              pricePerLiter: customer.pricePerLiter != null ? decimalToNumber(customer.pricePerLiter) : null,
              isActive: customer.isActive,
            },
            entry: entry
              ? {
                  id: entry.id,
                  customerId: entry.customerId,
                  morningLiters: entry.morningLiters != null ? decimalToNumber(entry.morningLiters) : null,
                  eveningLiters: entry.eveningLiters != null ? decimalToNumber(entry.eveningLiters) : null,
                  totalLiters: decimalToNumber(entry.totalLiters),
                  notes: entry.notes,
                }
              : null,
          }))}
          entryMode={settings.entryMode}
        />
      </div>
    </div>
  );
}

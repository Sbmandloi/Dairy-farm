import { getDailyEntriesWithCustomers, getDailySummary } from "@/lib/services/daily-entry.service";
import { getSettings } from "@/lib/services/settings.service";
import { Header } from "@/components/layout/header";
import { EntryGrid } from "@/components/daily-entry/entry-grid";
import { DateNavigator } from "@/components/daily-entry/date-navigator";
import { formatDate, formatLiters, formatCurrency } from "@/lib/utils/format";
import { Card, CardContent } from "@/components/ui/card";
import { Milk, Users, IndianRupee } from "lucide-react";
import { decimalToNumber } from "@/lib/utils/format";

interface PageProps {
  searchParams: Promise<{ date?: string }>;
}

export default async function DailyEntryPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const dateStr = params.date || new Date().toISOString().split("T")[0];
  const date = new Date(dateStr);
  date.setHours(0, 0, 0, 0);

  const [rows, summary, settings] = await Promise.all([
    getDailyEntriesWithCustomers(date),
    getDailySummary(date),
    getSettings(),
  ]);

  const price = parseFloat(String(settings.globalPricePerLiter));
  const estimatedRevenue = summary.totalLiters * price;

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
              <p className="font-bold text-blue-600">{formatLiters(summary.totalLiters)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <Users className="w-4 h-4 text-purple-500 mx-auto mb-1" />
              <p className="text-xs text-gray-500">Customers</p>
              <p className="font-bold text-purple-600">{summary.customerCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <IndianRupee className="w-4 h-4 text-green-500 mx-auto mb-1" />
              <p className="text-xs text-gray-500">Revenue</p>
              <p className="font-bold text-green-600">{formatCurrency(estimatedRevenue)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Entry Grid — serialize Prisma Decimal/Date to plain JS types */}
        <EntryGrid
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

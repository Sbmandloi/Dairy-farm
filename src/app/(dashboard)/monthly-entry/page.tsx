import { getMonthlyEntries } from "@/lib/services/daily-entry.service";
import { getSettings } from "@/lib/services/settings.service";
import { Header } from "@/components/layout/header";
import { MonthlyEntryGrid } from "@/components/daily-entry/monthly-entry-grid";
import { decimalToNumber } from "@/lib/utils/format";

interface PageProps {
  searchParams: Promise<{ year?: string; month?: string }>;
}

export default async function MonthlyEntryPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const now = new Date();
  const year = parseInt(params.year || String(now.getFullYear()));
  const month = parseInt(params.month || String(now.getMonth() + 1));

  const [{ customers, entries, daysInMonth }, settings] = await Promise.all([
    getMonthlyEntries(year, month),
    getSettings(),
  ]);

  // Serialize Prisma Decimal/Date to plain types for client component
  const serializedCustomers = customers.map((c) => ({
    id: c.id,
    name: c.name,
    phoneNumber: c.phoneNumber,
  }));

  const serializedEntries = entries.map((e) => ({
    id: e.id,
    customerId: e.customerId,
    date: e.date instanceof Date ? e.date.toISOString().split("T")[0] : String(e.date).split("T")[0],
    morningLiters: e.morningLiters != null ? decimalToNumber(e.morningLiters) : null,
    eveningLiters: e.eveningLiters != null ? decimalToNumber(e.eveningLiters) : null,
    totalLiters: decimalToNumber(e.totalLiters),
  }));

  return (
    <div>
      <Header title="Monthly Entry" />
      <div className="p-4 md:p-6">
        <MonthlyEntryGrid
          year={year}
          month={month}
          daysInMonth={daysInMonth}
          customers={serializedCustomers}
          entries={serializedEntries}
          entryMode={settings.entryMode}
        />
      </div>
    </div>
  );
}

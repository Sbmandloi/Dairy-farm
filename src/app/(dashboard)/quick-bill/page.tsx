import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/services/settings.service";
import { Header } from "@/components/layout/header";
import { QuickBillWizard, QuickBillCustomer } from "@/components/billing/quick-bill-wizard";

// Quantities/dues are computed live from entries and payments.
export const dynamic = "force-dynamic";

export default async function QuickBillPage() {
  const [rawCustomers, settings] = await Promise.all([
    prisma.customer.findMany({
      // Archived customers must never be billed.
      where: { isActive: true, deletedAt: null },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        phoneNumber: true,
        address: true,
        pricePerLiter: true,
      },
    }),
    getSettings(),
  ]);

  // Serialize Prisma Decimal → number for client boundary
  const customers: QuickBillCustomer[] = rawCustomers.map((c) => ({
    id: c.id,
    name: c.name,
    phoneNumber: c.phoneNumber,
    address: c.address,
    pricePerLiter: c.pricePerLiter != null ? parseFloat(String(c.pricePerLiter)) : null,
  }));

  return (
    <div>
      <Header title="Quick Bill" />
      <div className="p-4 md:p-6">
        <div className="mb-5">
          <h1 className="text-lg font-semibold text-gray-900">Bill a customer for one or more months</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Quantity is summed from daily entries and the rate is taken from the
            customer&apos;s record — nothing to type in. Preview, print or send it on
            WhatsApp in Hindi.
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
          <QuickBillWizard
            customers={customers}
            settings={{
              farmName: settings.farmName,
              farmAddress: settings.farmAddress ?? null,
              farmPhone: settings.farmPhone ?? null,
              globalPricePerLiter: parseFloat(String(settings.globalPricePerLiter)),
            }}
          />
        </div>
      </div>
    </div>
  );
}

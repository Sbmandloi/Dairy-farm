import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/layout/header";
import { AutoRefresh } from "@/components/dashboard/auto-refresh";
import { CustomerManager } from "@/components/customers/customer-manager";
import { getCustomersForManager } from "@/lib/services/customer.service";
import { getCollectionsByCustomer } from "@/lib/services/payment.service";
import { getSettings } from "@/lib/services/settings.service";
import { decimalToNumber } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function CustomerManagerPage() {
  const [customers, collections, settings] = await Promise.all([
    getCustomersForManager(),
    getCollectionsByCustomer(),
    getSettings(),
  ]);
  const generatedAt = Date.now();

  return (
    <div>
      <Header title="Customer Manager" actions={<AutoRefresh generatedAt={generatedAt} />} />

      <div className="p-4 md:p-6 space-y-5">
        {/* Intro */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="hidden sm:grid place-items-center w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex-shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Dues, collections &amp; reminders</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Every customer in one place — edit inline, record payments, and send
                WhatsApp reminders. Changes are staged until you save.
              </p>
            </div>
          </div>
          <Link href="/customers/new" className="flex-shrink-0">
            <Button size="sm">
              <Plus className="w-4 h-4" />
              Add Customer
            </Button>
          </Link>
        </div>

        <CustomerManager
          customers={customers}
          collections={collections}
          globalPricePerLiter={decimalToNumber(settings.globalPricePerLiter)}
        />
      </div>
    </div>
  );
}

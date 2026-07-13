import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
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

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customer Manager</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Every customer, their dues, collections and reminders — edit inline, then save.
          </p>
        </div>
        <Link href="/customers/new">
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
  );
}

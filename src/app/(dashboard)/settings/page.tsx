import { getSettings } from "@/lib/services/settings.service";
import { Header } from "@/components/layout/header";
import { SettingsForm } from "@/components/settings/settings-form";
import { decimalToNumber } from "@/lib/utils/format";

export default async function SettingsPage() {
  const settings = await getSettings();

  // Serialize Prisma Decimal → number before passing to Client Component
  const serialized = {
    id: settings.id,
    farmName: settings.farmName,
    farmAddress: settings.farmAddress,
    farmPhone: settings.farmPhone,
    globalPricePerLiter: decimalToNumber(settings.globalPricePerLiter),
    billingCycleType: settings.billingCycleType,
    entryMode: settings.entryMode,
    whatsappBusinessAcctId: settings.whatsappBusinessAcctId,
    whatsappPhoneNumberId: settings.whatsappPhoneNumberId,
    whatsappTemplateName: settings.whatsappTemplateName,
  };

  return (
    <div>
      <Header title="Settings" />
      <div className="p-4 md:p-6 max-w-2xl">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Application Settings</h2>
          <p className="text-sm text-gray-500 mt-1">Configure your farm details and billing preferences</p>
        </div>
        <SettingsForm settings={serialized} />
      </div>
    </div>
  );
}

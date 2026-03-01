import { getSettings } from "@/lib/services/settings.service";
import { getUsers } from "@/lib/services/user.service";
import { auth } from "@/lib/auth";
import { Header } from "@/components/layout/header";
import { SettingsForm } from "@/components/settings/settings-form";
import { UserManagement, SerializedUser } from "@/components/settings/user-management";
import { decimalToNumber } from "@/lib/utils/format";

export default async function SettingsPage() {
  const [settings, rawUsers, session] = await Promise.all([
    getSettings(),
    getUsers(),
    auth(),
  ]);

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
    whatsappConfigured: !!(settings.whatsappPhoneNumberId && settings.whatsappAccessToken),
  };

  const users: SerializedUser[] = rawUsers.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    createdAt: u.createdAt.toISOString(),
    isCurrentUser: u.id === session?.user?.id,
  }));

  return (
    <div>
      <Header title="Settings" />
      <div className="p-4 md:p-6 max-w-2xl space-y-10">
        {/* Farm / billing settings */}
        <div>
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Application Settings</h2>
            <p className="text-sm text-gray-500 mt-1">Configure your farm details and billing preferences</p>
          </div>
          <SettingsForm settings={serialized} />
        </div>

        {/* Divider */}
        <div className="border-t border-gray-200" />

        {/* User management */}
        <UserManagement users={users} />
      </div>
    </div>
  );
}

import { getSettings } from "@/lib/services/settings.service";
import { getUsers } from "@/lib/services/user.service";
import { auth } from "@/lib/auth";
import { Header } from "@/components/layout/header";
import { SettingsForm } from "@/components/settings/settings-form";
import { UserManagement, SerializedUser } from "@/components/settings/user-management";
import { decimalToNumber } from "@/lib/utils/format";
import { Badge } from "@/components/ui/badge";
import { Building2, Users, CheckCircle2, AlertCircle } from "lucide-react";

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
      <div className="p-4 md:p-6 max-w-3xl space-y-6">
        {/* Farm / billing settings */}
        <section className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-start justify-between gap-3 px-5 py-4 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
            <div className="flex items-start gap-3">
              <div className="grid place-items-center w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex-shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">Farm &amp; Billing</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  Your farm details, the global rate, and how entries and bills work.
                </p>
              </div>
            </div>
            {/* Surfaces WhatsApp status up-front — it's what breaks bill delivery. */}
            <Badge
              variant={serialized.whatsappConfigured ? "success" : "secondary"}
              className="flex-shrink-0 gap-1"
            >
              {serialized.whatsappConfigured ? (
                <CheckCircle2 className="w-3 h-3" />
              ) : (
                <AlertCircle className="w-3 h-3" />
              )}
              WhatsApp {serialized.whatsappConfigured ? "connected" : "not set up"}
            </Badge>
          </div>
          <div className="p-5">
            <SettingsForm settings={serialized} />
          </div>
        </section>

        {/* User management */}
        <section className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-start gap-3 px-5 py-4 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
            <div className="grid place-items-center w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex-shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Users</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Who can sign in to this dairy account.
              </p>
            </div>
          </div>
          <div className="p-5">
            <UserManagement users={users} />
          </div>
        </section>
      </div>
    </div>
  );
}

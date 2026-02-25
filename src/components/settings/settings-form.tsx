"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { updateSettingsAction } from "@/lib/actions/settings.actions";
import { Loader2, CheckCircle } from "lucide-react";

// Plain serializable type — no Prisma Decimal or Date objects
interface FormSettings {
  id: string;
  farmName: string;
  farmAddress: string | null;
  farmPhone: string | null;
  globalPricePerLiter: number;   // converted from Decimal by the page
  billingCycleType: string;
  entryMode: string;
  whatsappBusinessAcctId: string | null;
  whatsappPhoneNumberId: string | null;
  whatsappTemplateName: string | null;
}

interface SettingsFormProps {
  settings: FormSettings;
}

export function SettingsForm({ settings }: SettingsFormProps) {
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [entryMode, setEntryMode] = useState(settings.entryMode);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaved(false);
    setError("");

    const formData = new FormData(e.currentTarget);
    formData.set("entryMode", entryMode);

    startTransition(async () => {
      const result = await updateSettingsAction(formData);
      if (result.success) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Farm Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Farm Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="farmName">Farm Name *</Label>
            <Input id="farmName" name="farmName" defaultValue={settings.farmName} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="farmAddress">Address</Label>
            <Textarea id="farmAddress" name="farmAddress" defaultValue={settings.farmAddress ?? ""} rows={2} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="farmPhone">Phone Number</Label>
            <Input id="farmPhone" name="farmPhone" defaultValue={settings.farmPhone ?? ""} placeholder="+91 9000000000" />
          </div>
        </CardContent>
      </Card>

      {/* Billing Config */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Billing Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="globalPricePerLiter">Global Price per Liter (₹) *</Label>
            <Input
              id="globalPricePerLiter"
              name="globalPricePerLiter"
              type="number"
              step="0.01"
              min="0.01"
              defaultValue={settings.globalPricePerLiter}
              required
            />
            <p className="text-xs text-gray-400">Used for customers without a custom price</p>
          </div>

          <div className="space-y-1.5">
            <Label>Entry Mode</Label>
            <div className="flex gap-3">
              {[
                { value: "SPLIT", label: "Split (Morning + Evening)", desc: "Enter separate morning & evening quantities" },
                { value: "SINGLE", label: "Single Total", desc: "Enter daily total directly" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setEntryMode(opt.value)}
                  className={`flex-1 p-3 rounded-lg border-2 text-left transition-colors ${
                    entryMode === opt.value
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <p className={`text-sm font-medium ${entryMode === opt.value ? "text-blue-700" : "text-gray-700"}`}>
                    {opt.label}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>
            <input type="hidden" name="billingCycleType" value="MONTHLY" />
          </div>
        </CardContent>
      </Card>

      {/* WhatsApp Config — Green API */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">WhatsApp (Green API — Free)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-xs text-green-800 space-y-1">
            <p className="font-semibold">Setup steps:</p>
            <ol className="list-decimal list-inside space-y-0.5">
              <li>Sign up at <span className="font-mono">green-api.com</span> (free plan)</li>
              <li>Create an instance → scan the QR code with your WhatsApp</li>
              <li>Copy <strong>idInstance</strong> and <strong>apiTokenInstance</strong> below</li>
            </ol>
            <p className="text-green-700 mt-1">Free plan: 200 messages/day • No Meta approval needed</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="whatsappPhoneNumberId">Instance ID (idInstance)</Label>
            <Input
              id="whatsappPhoneNumberId"
              name="whatsappPhoneNumberId"
              defaultValue={settings.whatsappPhoneNumberId ?? ""}
              placeholder="e.g. 1101234567"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="whatsappAccessToken">API Token (apiTokenInstance)</Label>
            <Input
              id="whatsappAccessToken"
              name="whatsappAccessToken"
              type="password"
              defaultValue=""
              placeholder="Leave blank to keep existing token"
            />
            <p className="text-xs text-gray-400">Stored encrypted. Leave blank to keep the current token.</p>
          </div>

          {/* Hidden fields to satisfy schema (not used for Green API) */}
          <input type="hidden" name="whatsappBusinessAcctId" value={settings.whatsappBusinessAcctId ?? ""} />
          <input type="hidden" name="whatsappTemplateName" value={settings.whatsappTemplateName ?? ""} />
        </CardContent>
      </Card>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <Button type="submit" disabled={isPending}>
        {isPending ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
        ) : saved ? (
          <><CheckCircle className="w-4 h-4 text-green-500" /> Saved!</>
        ) : (
          "Save Settings"
        )}
      </Button>
    </form>
  );
}

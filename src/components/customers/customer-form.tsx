"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createCustomerAction, updateCustomerAction } from "@/lib/actions/customer.actions";
import { cn } from "@/lib/utils";
import { Loader2, User, Phone, MapPin, IndianRupee, Calendar, AlertCircle } from "lucide-react";

// Plain serializable type — no Prisma Decimal or Date objects
interface FormCustomer {
  id: string;
  name: string;
  phoneNumber: string | null;
  address: string | null;
  pricePerLiter: number | null; // already converted from Decimal by the page
  startDate: string;            // ISO date string "YYYY-MM-DD"
}

interface CustomerFormProps {
  customer?: FormCustomer;
}

const AVATAR_COLORS = [
  "bg-blue-500", "bg-emerald-500", "bg-violet-500",
  "bg-orange-500", "bg-rose-500", "bg-teal-500",
  "bg-indigo-500", "bg-amber-500",
];
function avatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts.slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

export function CustomerForm({ customer }: CustomerFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [globalError, setGlobalError] = useState("");
  // Controlled only for the live avatar preview; still submitted via FormData.
  const [name, setName] = useState(customer?.name ?? "");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    setGlobalError("");

    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = customer
        ? await updateCustomerAction(customer.id, formData)
        : await createCustomerAction(formData);

      if (result.success) {
        router.push("/customers");
        router.refresh();
      } else {
        setGlobalError(result.error);
        if (result.fieldErrors) setErrors(result.fieldErrors);
      }
    });
  }

  const trimmed = name.trim();

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl">
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        {/* Avatar preview header */}
        <div className="flex items-center gap-4 px-5 py-4 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
          <div
            className={cn(
              "w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm flex-shrink-0 transition-colors",
              trimmed ? avatarColor(trimmed) : "bg-gray-200"
            )}
          >
            <span className="text-lg font-bold text-white tracking-wide">
              {trimmed ? getInitials(trimmed) : "?"}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-base font-semibold text-gray-900 truncate">
              {trimmed || (customer ? "Edit customer" : "New customer")}
            </p>
            <p className="text-xs text-gray-500">
              {customer ? "Update the details below" : "Fill in the details to add a customer"}
            </p>
          </div>
        </div>

        <div className="p-5 space-y-6">
          {/* Section: Contact details */}
          <section className="space-y-4">
            <SectionTitle>Contact details</SectionTitle>

            <Field label="Full name" htmlFor="name" required error={errors.name?.[0]}>
              <IconInput icon={User}>
                <Input
                  id="name"
                  name="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Ramesh Patel"
                  className="pl-9"
                  required
                />
              </IconInput>
            </Field>

            <Field
              label="Phone number"
              htmlFor="phoneNumber"
              hint="Optional — 10-digit mobile. Required for WhatsApp invoicing."
              error={errors.phoneNumber?.[0]}
            >
              <IconInput icon={Phone}>
                <Input
                  id="phoneNumber"
                  name="phoneNumber"
                  type="tel"
                  inputMode="tel"
                  defaultValue={customer?.phoneNumber ?? ""}
                  placeholder="+91 98765 43210"
                  className="pl-9"
                />
              </IconInput>
            </Field>

            <Field label="Address" htmlFor="address">
              <div className="relative">
                <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
                <Textarea
                  id="address"
                  name="address"
                  defaultValue={customer?.address ?? ""}
                  placeholder="Village, District..."
                  rows={2}
                  className="pl-9"
                />
              </div>
            </Field>
          </section>

          {/* Section: Billing */}
          <section className="space-y-4">
            <SectionTitle>Billing</SectionTitle>

            <div className="grid sm:grid-cols-2 gap-4">
              <Field
                label="Custom price / liter"
                htmlFor="pricePerLiter"
                hint="Leave blank to use the global rate."
                error={errors.pricePerLiter?.[0]}
              >
                <IconInput icon={IndianRupee}>
                  <Input
                    id="pricePerLiter"
                    name="pricePerLiter"
                    type="number"
                    step="0.01"
                    min="0"
                    inputMode="decimal"
                    defaultValue={customer?.pricePerLiter ?? ""}
                    placeholder="Global rate"
                    className="pl-9"
                  />
                </IconInput>
              </Field>

              <Field label="Start date" htmlFor="startDate" required error={errors.startDate?.[0]}>
                <IconInput icon={Calendar}>
                  <Input
                    id="startDate"
                    name="startDate"
                    type="date"
                    defaultValue={customer?.startDate ?? new Date().toISOString().split("T")[0]}
                    className="pl-9"
                    required
                  />
                </IconInput>
              </Field>
            </div>
          </section>

          {globalError && (
            <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{globalError}</span>
            </div>
          )}
        </div>

        {/* Sticky action bar */}
        <div className="flex gap-3 px-5 py-4 bg-gray-50 border-t border-gray-100">
          <Button type="submit" disabled={isPending || !trimmed} className="min-w-36">
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {customer ? "Update Customer" : "Create Customer"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={isPending}>
            Cancel
          </Button>
        </div>
      </div>
    </form>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">{children}</h3>
  );
}

function Field({
  label,
  htmlFor,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </Label>
      {children}
      {error ? (
        <p className="flex items-center gap-1 text-xs text-red-500">
          <AlertCircle className="w-3 h-3" />
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-gray-400">{hint}</p>
      ) : null}
    </div>
  );
}

function IconInput({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
      {children}
    </div>
  );
}

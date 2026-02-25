"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createCustomerAction, updateCustomerAction } from "@/lib/actions/customer.actions";
import { Loader2 } from "lucide-react";
import { useState } from "react";

// Plain serializable type — no Prisma Decimal or Date objects
interface FormCustomer {
  id: string;
  name: string;
  phoneNumber: string;
  address: string | null;
  pricePerLiter: number | null; // already converted from Decimal by the page
  startDate: string;            // ISO date string "YYYY-MM-DD"
}

interface CustomerFormProps {
  customer?: FormCustomer;
}

export function CustomerForm({ customer }: CustomerFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [globalError, setGlobalError] = useState("");

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

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-lg">
      <div className="space-y-1.5">
        <Label htmlFor="name">Full Name *</Label>
        <Input
          id="name"
          name="name"
          defaultValue={customer?.name}
          placeholder="e.g. Ramesh Patel"
          required
        />
        {errors.name && <p className="text-xs text-red-500">{errors.name[0]}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="phoneNumber">Phone Number *</Label>
        <Input
          id="phoneNumber"
          name="phoneNumber"
          defaultValue={customer?.phoneNumber}
          placeholder="+91 98765 43210"
          required
        />
        <p className="text-xs text-gray-400">Enter 10-digit mobile number. Will be used for WhatsApp invoicing.</p>
        {errors.phoneNumber && <p className="text-xs text-red-500">{errors.phoneNumber[0]}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="address">Address</Label>
        <Textarea
          id="address"
          name="address"
          defaultValue={customer?.address ?? ""}
          placeholder="Village, District..."
          rows={2}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="pricePerLiter">Custom Price per Liter (₹)</Label>
        <Input
          id="pricePerLiter"
          name="pricePerLiter"
          type="number"
          step="0.01"
          min="0"
          defaultValue={customer?.pricePerLiter ?? ""}
          placeholder="Leave blank to use global rate"
        />
        {errors.pricePerLiter && <p className="text-xs text-red-500">{errors.pricePerLiter[0]}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="startDate">Start Date *</Label>
        <Input
          id="startDate"
          name="startDate"
          type="date"
          defaultValue={customer?.startDate ?? new Date().toISOString().split("T")[0]}
          required
        />
      </div>

      {globalError && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {globalError}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          {customer ? "Update Customer" : "Create Customer"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

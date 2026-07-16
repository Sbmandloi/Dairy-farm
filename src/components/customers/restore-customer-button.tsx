"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { restoreCustomerAction } from "@/lib/actions/customer.actions";
import { Loader2, RotateCcw } from "lucide-react";

interface RestoreCustomerButtonProps {
  customerId: string;
  iconOnly?: boolean;
}

/** Bring an archived (soft-deleted) customer and all their retained data back. */
export function RestoreCustomerButton({ customerId, iconOnly }: RestoreCustomerButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRestore() {
    setLoading(true);
    setError(null);
    const result = await restoreCustomerAction(customerId);
    if (result && !result.success) {
      setError(result.error ?? "Failed to restore");
      setLoading(false);
      return;
    }
    setLoading(false);
    router.refresh();
  }

  return (
    <Button
      variant="outline"
      size={iconOnly ? "icon" : "sm"}
      onClick={handleRestore}
      disabled={loading}
      title={error ?? "Restore customer"}
      className="text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700"
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <RotateCcw className="w-4 h-4" />
      )}
      {!iconOnly && (loading ? "Restoring…" : "Restore")}
    </Button>
  );
}

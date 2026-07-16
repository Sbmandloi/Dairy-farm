"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { deleteCustomerAction } from "@/lib/actions/customer.actions";
import { Loader2, Archive, AlertTriangle } from "lucide-react";

interface DeleteCustomerButtonProps {
  customerId: string;
  customerName: string;
  iconOnly?: boolean;
}

/**
 * "Archive" (soft delete). Nothing is removed from the database — the customer
 * and all their history are hidden from the app and can be restored later from
 * the Archived tab.
 */
export function DeleteCustomerButton({ customerId, customerName, iconOnly }: DeleteCustomerButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleArchive() {
    setLoading(true);
    setError(null);
    const result = await deleteCustomerAction(customerId);
    if (result && !result.success) {
      setError(result.error ?? "Failed to archive customer");
      setLoading(false);
      return;
    }
    setOpen(false);
    setLoading(false);
    router.refresh();
  }

  return (
    <>
      <Button
        variant="outline"
        size={iconOnly ? "icon" : "sm"}
        onClick={() => setOpen(true)}
        title="Archive customer"
        className="text-amber-600 border-amber-200 hover:bg-amber-50 hover:text-amber-700"
      >
        <Archive className="w-4 h-4" />
        {!iconOnly && "Archive"}
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => !loading && setOpen(false)}
          />

          <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-center w-14 h-14 rounded-full bg-amber-50 mx-auto mb-4">
              <AlertTriangle className="w-7 h-7 text-amber-500" />
            </div>

            <h2 className="text-lg font-bold text-gray-900 text-center mb-1">Archive Customer</h2>
            <p className="text-sm text-gray-500 text-center mb-1">Archive</p>
            <p className="text-sm font-semibold text-gray-800 text-center mb-4">
              &ldquo;{customerName}&rdquo;?
            </p>
            <p className="text-xs text-gray-600 text-center bg-amber-50 rounded-lg px-3 py-2 mb-5">
              Their bills, payments and daily entries are <strong>kept in the database</strong>.
              They&apos;ll be hidden from all lists and reports, and you can restore them
              anytime from the <strong>Archived</strong> tab.
            </p>

            {error && (
              <p className="text-sm text-red-600 text-center mb-3 bg-red-50 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setOpen(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white"
                onClick={handleArchive}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-1" />
                    Archiving…
                  </>
                ) : (
                  <>
                    <Archive className="w-4 h-4 mr-1" />
                    Archive
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

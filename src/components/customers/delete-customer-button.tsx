"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { deleteCustomerAction } from "@/lib/actions/customer.actions";
import { Loader2, Trash2, AlertTriangle } from "lucide-react";

interface DeleteCustomerButtonProps {
  customerId: string;
  customerName: string;
  iconOnly?: boolean;
}

export function DeleteCustomerButton({ customerId, customerName, iconOnly }: DeleteCustomerButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setLoading(true);
    setError(null);
    const result = await deleteCustomerAction(customerId);
    if (result && !result.success) {
      setError(result.error ?? "Failed to delete customer");
      setLoading(false);
    }
    // On success, redirect is handled server-side
  }

  return (
    <>
      <Button
        variant="destructive"
        size={iconOnly ? "icon" : "sm"}
        onClick={() => setOpen(true)}
        title="Delete customer"
      >
        <Trash2 className="w-4 h-4" />
        {!iconOnly && "Delete"}
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => !loading && setOpen(false)}
          />

          {/* Dialog */}
          <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4 animate-in fade-in zoom-in-95 duration-150">
            {/* Icon */}
            <div className="flex items-center justify-center w-14 h-14 rounded-full bg-red-50 mx-auto mb-4">
              <AlertTriangle className="w-7 h-7 text-red-500" />
            </div>

            <h2 className="text-lg font-bold text-gray-900 text-center mb-1">Delete Customer</h2>
            <p className="text-sm text-gray-500 text-center mb-1">
              Are you sure you want to delete
            </p>
            <p className="text-sm font-semibold text-gray-800 text-center mb-4">
              &ldquo;{customerName}&rdquo;?
            </p>
            <p className="text-xs text-red-500 text-center bg-red-50 rounded-lg px-3 py-2 mb-5">
              This will permanently delete all their bills, payments, and daily entries. This action cannot be undone.
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
                variant="destructive"
                className="flex-1"
                onClick={handleDelete}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-1" />
                    Deleting…
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-1" />
                    Delete
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

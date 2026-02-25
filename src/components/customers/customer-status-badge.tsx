"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toggleCustomerStatusAction } from "@/lib/actions/customer.actions";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface CustomerToggleButtonProps {
  customerId: string;
  isActive: boolean;
}

export function CustomerToggleButton({ customerId, isActive }: CustomerToggleButtonProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleToggle() {
    setLoading(true);
    await toggleCustomerStatusAction(customerId);
    setLoading(false);
    router.refresh();
  }

  return (
    <Button
      variant={isActive ? "destructive" : "secondary"}
      size="sm"
      onClick={handleToggle}
      disabled={loading}
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : isActive ? "Deactivate" : "Activate"}
    </Button>
  );
}

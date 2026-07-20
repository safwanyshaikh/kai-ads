"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { API_ROUTES } from "@/lib/constants";
import { postJson } from "@/lib/api-client";

/** KAI Super Admin only (agency:manage_quota) — always adds to, never replaces, the agency's total quota. */
export function AgencyQuotaGrant({ agencyId }: { agencyId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState("");

  function grant() {
    setError(null);
    const parsed = Number(amount);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      setError("Enter a whole number greater than 0.");
      return;
    }
    startTransition(async () => {
      const result = await postJson(API_ROUTES.agencyQuota(agencyId), { amount: parsed });
      if (!result.ok) {
        setError(result.message ?? "Could not grant quota");
        return;
      }
      setShowForm(false);
      setAmount("");
      router.refresh();
    });
  }

  if (showForm) {
    return (
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={1}
          placeholder="e.g. 100"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-24"
        />
        <Button size="sm" disabled={isPending || !amount} onClick={grant}>
          Add Generations
        </Button>
        <Button size="sm" variant="ghost" disabled={isPending} onClick={() => setShowForm(false)}>
          Cancel
        </Button>
        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>
    );
  }

  return (
    <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
      Grant Additional Generations
    </Button>
  );
}

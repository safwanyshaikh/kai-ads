"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { API_ROUTES } from "@/lib/constants";
import { postJson } from "@/lib/api-client";

export function JoinRequestActions({ joinRequestId }: { joinRequestId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handle(action: "approve" | "reject") {
    setError(null);
    startTransition(async () => {
      const url =
        action === "approve"
          ? API_ROUTES.joinRequestApprove(joinRequestId)
          : API_ROUTES.joinRequestReject(joinRequestId);
      const result = await postJson(url);
      if (!result.ok) {
        setError(result.message ?? "Action failed");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-xs text-destructive">{error}</span>}
      <Button size="sm" variant="outline" disabled={isPending} onClick={() => handle("reject")}>
        Reject
      </Button>
      <Button size="sm" disabled={isPending} onClick={() => handle("approve")}>
        Approve
      </Button>
    </div>
  );
}

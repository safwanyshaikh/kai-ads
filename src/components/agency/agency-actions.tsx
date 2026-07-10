"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { API_ROUTES } from "@/lib/constants";
import { postJson } from "@/lib/api-client";
import type { AgencyStatus } from "@prisma/client";

export function AgencyActions({
  agencyId,
  status,
}: {
  agencyId: string;
  status: AgencyStatus;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [reasonFor, setReasonFor] = useState<"reject" | "suspend" | null>(null);
  const [reason, setReason] = useState("");

  function run(action: "approve" | "reject" | "suspend" | "activate", withReason?: string) {
    setError(null);
    startTransition(async () => {
      const url = {
        approve: API_ROUTES.agencyApprove(agencyId),
        reject: API_ROUTES.agencyReject(agencyId),
        suspend: API_ROUTES.agencySuspend(agencyId),
        activate: API_ROUTES.agencyActivate(agencyId),
      }[action];

      const result = await postJson(url, withReason ? { reason: withReason } : undefined);
      if (!result.ok) {
        setError(result.message ?? "Action failed");
        return;
      }
      setReasonFor(null);
      setReason("");
      router.refresh();
    });
  }

  if (reasonFor) {
    return (
      <div className="space-y-2">
        <Textarea
          placeholder={`Reason for ${reasonFor === "reject" ? "rejection" : "suspension"}`}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="destructive"
            disabled={isPending || reason.trim().length < 3}
            onClick={() => run(reasonFor, reason.trim())}
          >
            Confirm {reasonFor === "reject" ? "Rejection" : "Suspension"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setReasonFor(null)}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {error && <span className="text-xs text-destructive">{error}</span>}
      {status === "PENDING" && (
        <>
          <Button size="sm" disabled={isPending} onClick={() => run("approve")}>
            Approve
          </Button>
          <Button size="sm" variant="outline" disabled={isPending} onClick={() => setReasonFor("reject")}>
            Reject
          </Button>
        </>
      )}
      {status === "APPROVED" && (
        <Button size="sm" variant="outline" disabled={isPending} onClick={() => setReasonFor("suspend")}>
          Suspend
        </Button>
      )}
      {status === "SUSPENDED" && (
        <Button size="sm" disabled={isPending} onClick={() => run("activate")}>
          Activate
        </Button>
      )}
    </div>
  );
}

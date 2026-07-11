"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { API_ROUTES } from "@/lib/constants";
import { postJson } from "@/lib/api-client";

export function AgencyVerificationActions({
  agencyId,
  status,
}: {
  agencyId: string;
  status: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showVerifyForm, setShowVerifyForm] = useState(false);
  const [verificationUrl, setVerificationUrl] = useState("");

  function run(action: "suspend" | "restore" | "require-reverification") {
    setError(null);
    startTransition(async () => {
      const url = {
        suspend: API_ROUTES.agencyVerificationSuspend(agencyId),
        restore: API_ROUTES.agencyVerificationRestore(agencyId),
        "require-reverification": API_ROUTES.agencyVerificationReverify(agencyId),
      }[action];
      const result = await postJson(url);
      if (!result.ok) {
        setError(result.message ?? "Action failed");
        return;
      }
      router.refresh();
    });
  }

  function verify() {
    setError(null);
    startTransition(async () => {
      const result = await postJson(API_ROUTES.agencyVerification(agencyId), {
        officialVerificationUrl: verificationUrl,
      });
      if (!result.ok) {
        setError(result.message ?? "Could not verify agency");
        return;
      }
      setShowVerifyForm(false);
      setVerificationUrl("");
      router.refresh();
    });
  }

  if (showVerifyForm) {
    return (
      <div className="space-y-2">
        <Input
          placeholder="https://emigrate.gov.in/agency/..."
          value={verificationUrl}
          onChange={(e) => setVerificationUrl(e.target.value)}
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex gap-2">
          <Button size="sm" disabled={isPending || !verificationUrl} onClick={verify}>
            Confirm Verification
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setShowVerifyForm(false)}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {error && <span className="text-xs text-destructive">{error}</span>}
      {status !== "VERIFIED" && (
        <Button size="sm" disabled={isPending} onClick={() => setShowVerifyForm(true)}>
          Verify
        </Button>
      )}
      {status === "VERIFIED" && (
        <Button size="sm" variant="outline" disabled={isPending} onClick={() => run("suspend")}>
          Suspend
        </Button>
      )}
      {status === "SUSPENDED" && (
        <Button size="sm" disabled={isPending} onClick={() => run("restore")}>
          Restore
        </Button>
      )}
      {status === "VERIFIED" && (
        <Button size="sm" variant="ghost" disabled={isPending} onClick={() => run("require-reverification")}>
          Require Reverification
        </Button>
      )}
    </div>
  );
}

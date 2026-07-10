"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { API_ROUTES } from "@/lib/constants";
import { postJson } from "@/lib/api-client";

type LifecycleAction = "duplicate" | "archive" | "restore" | "delete";

/**
 * Single source of the "call the lifecycle endpoint, handle the error,
 * refresh" logic shared by the Library row actions and the Detail page
 * actions. The two call sites differ only in which buttons they render
 * and what happens after a successful duplicate (stay vs navigate) —
 * that's still each component's job; this hook owns the network/error
 * handling both previously duplicated in full.
 */
export function useAdvertisementActions(id: string) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: LifecycleAction, onSuccess?: (data: unknown) => void) {
    setError(null);
    startTransition(async () => {
      const url = {
        duplicate: API_ROUTES.advertisementDuplicate(id),
        archive: API_ROUTES.advertisementArchive(id),
        restore: API_ROUTES.advertisementRestore(id),
        delete: API_ROUTES.advertisementDelete(id),
      }[action];

      const result = await postJson(url);
      if (!result.ok) {
        setError(result.message ?? "Action failed");
        return;
      }
      if (onSuccess) {
        onSuccess(result.data);
      } else {
        router.refresh();
      }
    });
  }

  function changeStatus(toStatus: string, onSuccess?: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await postJson(API_ROUTES.advertisementStatus(id), { toStatus });
      if (!result.ok) {
        setError(result.message ?? "Could not update status");
        return;
      }
      if (onSuccess) {
        onSuccess();
      } else {
        router.refresh();
      }
    });
  }

  return { run, changeStatus, error, isPending };
}

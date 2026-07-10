"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAdvertisementActions } from "@/components/advertisement/use-advertisement-actions";

const NEXT_STATUS: Record<string, string | null> = {
  DRAFT: "REVIEW",
  REVIEW: "APPROVED",
  APPROVED: null,
  ARCHIVED: null,
};

export function AdvertisementDetailActions({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const router = useRouter();
  const { run, changeStatus, error, isPending } = useAdvertisementActions(id);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {error && <span className="text-xs text-destructive">{error}</span>}
      {NEXT_STATUS[status] && (
        <Button size="sm" disabled={isPending} onClick={() => changeStatus(NEXT_STATUS[status]!)}>
          Move to {NEXT_STATUS[status]}
        </Button>
      )}
      <Button
        size="sm"
        variant="outline"
        disabled={isPending}
        onClick={() =>
          run("duplicate", (data) => {
            const created = data as { id: string };
            router.push(`/dashboard/advertisements/${created.id}`);
          })
        }
      >
        Duplicate
      </Button>
      {status === "ARCHIVED" ? (
        <Button size="sm" variant="outline" disabled={isPending} onClick={() => run("restore")}>
          Restore
        </Button>
      ) : (
        <Button size="sm" variant="outline" disabled={isPending} onClick={() => run("archive")}>
          Archive
        </Button>
      )}
      <Button size="sm" variant="ghost" disabled={isPending} onClick={() => run("delete")}>
        Delete
      </Button>
    </div>
  );
}

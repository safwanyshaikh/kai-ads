"use client";

import { Button } from "@/components/ui/button";
import { useAdvertisementActions } from "@/components/advertisement/use-advertisement-actions";

export function AdvertisementRowActions({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const { run, error, isPending } = useAdvertisementActions(id);

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-xs text-destructive">{error}</span>}
      <Button size="sm" variant="outline" disabled={isPending} onClick={() => run("duplicate")}>
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

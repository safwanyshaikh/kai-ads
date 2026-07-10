import Link from "next/link";
import { Button } from "@/components/ui/button";

export function PaginationControls({
  basePath,
  page,
  totalPages,
  total,
  pageParam = "page",
}: {
  basePath: string;
  page: number;
  totalPages: number;
  total: number;
  pageParam?: string;
}) {
  if (totalPages <= 1) return null;

  const hrefFor = (targetPage: number) => `${basePath}?${pageParam}=${targetPage}`;

  return (
    <div className="flex items-center justify-between pt-2">
      <p className="text-xs text-muted-foreground">
        Page {page} of {totalPages} · {total} total
      </p>
      <div className="flex gap-2">
        <Button asChild size="sm" variant="outline" disabled={page <= 1}>
          <Link
            href={hrefFor(Math.max(1, page - 1))}
            aria-disabled={page <= 1}
            tabIndex={page <= 1 ? -1 : undefined}
          >
            Previous
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline" disabled={page >= totalPages}>
          <Link
            href={hrefFor(Math.min(totalPages, page + 1))}
            aria-disabled={page >= totalPages}
            tabIndex={page >= totalPages ? -1 : undefined}
          >
            Next
          </Link>
        </Button>
      </div>
    </div>
  );
}

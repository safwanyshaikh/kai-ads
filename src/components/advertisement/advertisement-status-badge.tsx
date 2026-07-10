import { Badge } from "@/components/ui/badge";

const STATUS_VARIANT: Record<string, "warning" | "success" | "destructive" | "secondary" | "outline"> = {
  DRAFT: "secondary",
  REVIEW: "warning",
  APPROVED: "success",
  ARCHIVED: "outline",
};

export function AdvertisementStatusBadge({ status }: { status: string }) {
  return <Badge variant={STATUS_VARIANT[status] ?? "outline"}>{status}</Badge>;
}

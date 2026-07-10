import { Badge } from "@/components/ui/badge";

const STATUS_VARIANT: Record<string, "warning" | "success" | "destructive" | "secondary" | "outline"> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "destructive",
  SUSPENDED: "destructive",
  ACTIVE: "success",
};

export function AgencyStatusBadge({ status }: { status: string }) {
  return <Badge variant={STATUS_VARIANT[status] ?? "outline"}>{status}</Badge>;
}

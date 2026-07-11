import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/session";
import { assertPermission, ForbiddenError } from "@/lib/rbac";
import { agencyService } from "@/server/services/agency.service";
import { agencyVerificationService } from "@/server/services/agency-verification.service";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AgencyVerificationActions } from "@/components/agency/agency-verification-actions";
import { APP_ROUTES } from "@/lib/constants";

export const metadata: Metadata = { title: "Agency Verification" };

const STATUS_VARIANT: Record<string, "warning" | "success" | "destructive" | "secondary" | "outline"> = {
  UNVERIFIED: "secondary",
  VERIFIED: "success",
  SUSPENDED: "destructive",
  REVERIFICATION_REQUIRED: "warning",
};

/** Agency Verification Workflow (Sprint 004) — KAI Super Admin only. */
export default async function AgencyVerificationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect(APP_ROUTES.login);
  if (user.status === "PENDING") redirect(APP_ROUTES.pendingApproval);

  try {
    assertPermission(user, "agency:verify");
  } catch (error) {
    if (error instanceof ForbiddenError) redirect(APP_ROUTES.dashboard);
    throw error;
  }

  const [agencies, verifications] = await Promise.all([
    agencyService.listAll({}),
    agencyVerificationService.listAll(),
  ]);

  const verificationByAgency = new Map(verifications.map((v) => [v.agencyId, v]));

  return (
    <DashboardShell user={user}>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Agency Verification</h1>
        <p className="text-muted-foreground">
          Verify agencies for the unified verification QR badge. Only verified agencies produce a working QR redirect.
        </p>
      </div>

      <div className="space-y-4">
        {agencies.map((agency) => {
          const verification = verificationByAgency.get(agency.id);
          const status = verification?.status ?? "UNVERIFIED";
          return (
            <Card key={agency.id}>
              <CardHeader className="flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle className="text-base">{agency.name}</CardTitle>
                  <CardDescription>{agency.registrationNumber}</CardDescription>
                </div>
                <Badge variant={STATUS_VARIANT[status] ?? "outline"}>{status.replace(/_/g, " ")}</Badge>
              </CardHeader>
              <CardContent>
                <AgencyVerificationActions agencyId={agency.id} status={verification?.status ?? null} />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </DashboardShell>
  );
}

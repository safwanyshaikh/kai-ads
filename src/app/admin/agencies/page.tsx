import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/session";
import { assertPermission } from "@/lib/rbac";
import { ForbiddenError } from "@/lib/rbac";
import { agencyService } from "@/server/services/agency.service";
import { parsePagination } from "@/lib/pagination";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AgencyStatusBadge } from "@/components/agency/agency-status-badge";
import { AgencyActions } from "@/components/agency/agency-actions";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { APP_ROUTES } from "@/lib/constants";

export const metadata: Metadata = { title: "Agency Approvals" };

/** KAI Super Admin Approval — Sprint 001. Approve / Reject / Suspend / Activate agencies. */
export default async function AdminAgenciesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect(APP_ROUTES.login);
  if (user.status === "PENDING") redirect(APP_ROUTES.pendingApproval);

  try {
    assertPermission(user, "agency:view_all");
  } catch (error) {
    if (error instanceof ForbiddenError) redirect(APP_ROUTES.dashboard);
    throw error;
  }

  const params = await searchParams;
  const pagination = parsePagination(params);
  const result = await agencyService.listAllPaginated(pagination);

  return (
    <DashboardShell user={user}>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Agency Approvals</h1>
        <p className="text-muted-foreground">
          Review and manage every agency registered on KAI Ads.
        </p>
      </div>

      <div className="space-y-4">
        {result.data.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              No agencies registered yet.
            </CardContent>
          </Card>
        )}

        {result.data.map((agency) => (
          <Card key={agency.id}>
            <CardHeader className="flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="text-base">{agency.name}</CardTitle>
                <CardDescription>
                  {agency.registrationNumber} · {agency.officialEmail}
                </CardDescription>
              </div>
              <AgencyStatusBadge status={agency.status} />
            </CardHeader>
            <CardContent>
              <AgencyActions agencyId={agency.id} status={agency.status} />
            </CardContent>
          </Card>
        ))}

        <PaginationControls
          basePath={APP_ROUTES.adminAgencies}
          page={result.page}
          totalPages={result.totalPages}
          total={result.total}
        />
      </div>
    </DashboardShell>
  );
}

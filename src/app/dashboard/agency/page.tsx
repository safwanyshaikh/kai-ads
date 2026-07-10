import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/session";
import { can } from "@/lib/rbac";
import { agencyService } from "@/server/services/agency.service";
import { joinRequestService } from "@/server/services/join-request.service";
import { agencyContactService } from "@/server/services/agency-contact.service";
import { paginationQuerySchema } from "@/lib/pagination";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AgencyStatusBadge } from "@/components/agency/agency-status-badge";
import { JoinRequestActions } from "@/components/agency/join-request-actions";
import { ContactDirectoryManager } from "@/components/advertisement/contact-directory-manager";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { APP_ROUTES } from "@/lib/constants";

export const metadata: Metadata = { title: "Agency" };

/** Agency Admin UI — manage own agency profile, team, join requests, and contact directory. */
export default async function AgencyAdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect(APP_ROUTES.login);
  if (user.status === "PENDING") redirect(APP_ROUTES.pendingApproval);
  if (!user.agencyId) redirect(APP_ROUTES.dashboard);

  const params = await searchParams;
  const teamPagination = paginationQuerySchema.parse({ page: params.teamPage, pageSize: params.pageSize });
  const requestsPagination = paginationQuerySchema.parse({ page: params.requestsPage, pageSize: params.pageSize });

  const [agency, teamPage, requestsPage, contacts] = await Promise.all([
    agencyService.getById(user.agencyId),
    agencyService.listEmployeesPaginated(user.agencyId, teamPagination),
    can(user, "join_request:review")
      ? joinRequestService.listForAgencyPaginated(user.agencyId, requestsPagination)
      : Promise.resolve({ data: [], page: 1, pageSize: 25, total: 0, totalPages: 1 }),
    can(user, "advertisement:view") ? agencyContactService.list(user.agencyId) : Promise.resolve([]),
  ]);

  type Employee = (typeof teamPage.data)[number];
  type PendingRequest = (typeof requestsPage.data)[number];

  return (
    <DashboardShell user={user}>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{agency.name}</h1>
          <p className="text-muted-foreground">{agency.registrationNumber}</p>
        </div>
        <AgencyStatusBadge status={agency.status} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Agency Profile</CardTitle>
            <CardDescription>Read-only in this sprint.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Website</span>
              <span>{agency.website}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Official Email</span>
              <span>{agency.officialEmail}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Team ({teamPage.total})</CardTitle>
            <CardDescription>Everyone with access to this agency.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {teamPage.data.map((employee: Employee) => (
              <div key={employee.id} className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium">{employee.name}</p>
                  <p className="text-muted-foreground">{employee.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{employee.role.replace("_", " ")}</Badge>
                  <Badge variant={employee.status === "ACTIVE" ? "success" : "secondary"}>
                    {employee.status}
                  </Badge>
                </div>
              </div>
            ))}
            <PaginationControls
              basePath={APP_ROUTES.dashboardAgency}
              page={teamPage.page}
              totalPages={teamPage.totalPages}
              total={teamPage.total}
              pageParam="teamPage"
            />
          </CardContent>
        </Card>

        {can(user, "join_request:review") && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Pending Join Requests ({requestsPage.total})</CardTitle>
              <CardDescription>
                Employees who detected this agency from their business email
                domain and are waiting for your approval.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {requestsPage.data.length === 0 && (
                <p className="text-sm text-muted-foreground">No pending requests.</p>
              )}
              {requestsPage.data.map((request: PendingRequest) => (
                <div key={request.id} className="flex items-center justify-between border-b pb-3 text-sm last:border-0 last:pb-0">
                  <div>
                    <p className="font-medium">{request.user.name}</p>
                    <p className="text-muted-foreground">{request.user.email}</p>
                  </div>
                  <JoinRequestActions joinRequestId={request.id} />
                </div>
              ))}
              <PaginationControls
                basePath={APP_ROUTES.dashboardAgency}
                page={requestsPage.page}
                totalPages={requestsPage.totalPages}
                total={requestsPage.total}
                pageParam="requestsPage"
              />
            </CardContent>
          </Card>
        )}

        {can(user, "advertisement:view") && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Contact Directory</CardTitle>
              <CardDescription>
                Saved contacts recruiters can attach to an advertisement
                instead of retyping details every time.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ContactDirectoryManager initialContacts={contacts} />
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardShell>
  );
}

import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { getCurrentUser } from "@/lib/session";
import { can } from "@/lib/rbac";
import { agencyService } from "@/server/services/agency.service";
import { joinRequestService } from "@/server/services/join-request.service";
import { agencyContactService } from "@/server/services/agency-contact.service";

import { paginationQuerySchema } from "@/lib/pagination";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Badge } from "@/components/ui/badge";

import { AgencyStatusBadge } from "@/components/agency/agency-status-badge";
import { JoinRequestActions } from "@/components/agency/join-request-actions";
import {
  AgencyProfileForm,
} from "@/components/agency/agency-profile-form";

import {
  ContactDirectoryManager,
} from "@/components/advertisement/contact-directory-manager";

import {
  PaginationControls,
} from "@/components/shared/pagination-controls";

import { APP_ROUTES } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Agency",
};

export default async function AgencyAdminPage({
  searchParams,
}: {
  searchParams: Promise<
    Record<string, string | undefined>
  >;
}) {
  const user =
    await getCurrentUser();

  if (!user) {
    redirect(
      APP_ROUTES.login,
    );
  }

  if (
    user.status ===
    "PENDING"
  ) {
    redirect(
      APP_ROUTES.pendingApproval,
    );
  }

  if (!user.agencyId) {
    redirect(
      APP_ROUTES.dashboard,
    );
  }

  const params =
    await searchParams;

  const teamPagination =
    paginationQuerySchema.parse({
      page:
        params.teamPage,
      pageSize:
        params.pageSize,
    });

  const requestsPagination =
    paginationQuerySchema.parse({
      page:
        params.requestsPage,
      pageSize:
        params.pageSize,
    });

  const [
    agency,
    teamPage,
    requestsPage,
    contacts,
  ] = await Promise.all([
    agencyService.getById(
      user.agencyId,
    ),

    agencyService.listEmployeesPaginated(
      user.agencyId,
      teamPagination,
    ),

    can(
      user,
      "join_request:review",
    )
      ? joinRequestService.listForAgencyPaginated(
          user.agencyId,
          requestsPagination,
        )
      : Promise.resolve({
          data: [],
          page: 1,
          pageSize: 25,
          total: 0,
          totalPages: 1,
        }),

    can(
      user,
      "advertisement:view",
    )
      ? agencyContactService.list(
          user.agencyId,
        )
      : Promise.resolve([]),
  ]);

  type Employee =
    (typeof teamPage.data)[number];

  type PendingRequest =
    (typeof requestsPage.data)[number];

  const verificationStatus =
    agency.verification
      ?.status ??
    "UNVERIFIED";

  const brandBadges =
    Array.isArray(
      agency.brandBadges,
    )
      ? (
          agency.brandBadges as unknown[]
        )
          .filter(
            (
              value,
            ): value is string =>
              typeof value ===
              "string",
          )
          .join("\n")
      : "";

  return (
    <DashboardShell user={user}>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-muted-foreground">
            Agency Administration
          </p>

          <h1 className="mt-1 text-3xl font-black tracking-tight">
            {agency.name}
          </h1>

          <p className="mt-1 text-sm font-semibold text-muted-foreground">
            RC / MEA Registration:{" "}
            {
              agency.registrationNumber
            }
          </p>
        </div>

        <div className="flex items-center gap-3">
          <AgencyStatusBadge
            status={
              agency.status
            }
          />

          <Badge
            variant={
              verificationStatus ===
              "VERIFIED"
                ? "success"
                : "secondary"
            }
          >
            {verificationStatus.replace(
              /_/g,
              " ",
            )}
          </Badge>
        </div>
      </div>

      <div className="space-y-6">
        {/* AGENCY PROFILE */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Agency Profile
            </CardTitle>

            <CardDescription>
              Permanent agency identity used
              across recruitment advertisements.
            </CardDescription>
          </CardHeader>

          <CardContent>
            {can(
              user,
              "agency:manage_own",
            ) ? (
              <AgencyProfileForm
                initial={{
                  logoUrl:
                    agency.logoUrl ??
                    "",

                  contactPerson:
                    agency.contactPerson ??
                    "",

                  phone:
                    agency.phone ??
                    "",

                  whatsapp:
                    agency.whatsapp ??
                    "",

                  officialEmail:
                    agency.officialEmail ??
                    "",

                  website:
                    agency.website ??
                    "",

                  officeAddress:
                    agency.officeAddress ??
                    "",

                  secondaryLogoUrl:
                    agency.secondaryLogoUrl ??
                    "",

                  brandBadges,
                }}

                agencyName={
                  agency.name
                }

                registrationNumber={
                  agency.registrationNumber
                }

                agencyStatus={
                  agency.status
                }

                verificationStatus={
                  verificationStatus
                }
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Agency Name
                  </p>

                  <p className="mt-1 font-semibold">
                    {agency.name}
                  </p>
                </div>

                <div className="rounded-lg border p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    RC / MEA Registration
                  </p>

                  <p className="mt-1 font-semibold">
                    {
                      agency.registrationNumber
                    }
                  </p>
                </div>

                <div className="rounded-lg border p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Official Email
                  </p>

                  <p className="mt-1 break-all font-semibold">
                    {
                      agency.officialEmail
                    }
                  </p>
                </div>

                <div className="rounded-lg border p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Official Website
                  </p>

                  <p className="mt-1 break-all font-semibold">
                    {
                      agency.website
                    }
                  </p>
                </div>

                <div className="rounded-lg border p-4 md:col-span-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Registered Office
                  </p>

                  <p className="mt-1 font-semibold">
                    {
                      agency.officeAddress ||
                      "Not provided"
                    }
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* VERIFIED IDENTITY */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Verified Agency Identity
            </CardTitle>

            <CardDescription>
              Registered identity and KAI verification
              are separate from campaign information.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Agency Name
                </p>

                <p className="mt-1 font-semibold">
                  {agency.name}
                </p>
              </div>

              <div className="rounded-lg border p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  RC / MEA Registration
                </p>

                <p className="mt-1 font-semibold">
                  {
                    agency.registrationNumber
                  }
                </p>
              </div>

              <div className="rounded-lg border p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Registration Authority
                </p>

                <p className="mt-1 font-semibold">
                  Ministry of External Affairs —
                  Government of India Registered
                </p>
              </div>

              <div className="rounded-lg border p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Agency Status
                </p>

                <div className="mt-2">
                  <AgencyStatusBadge
                    status={
                      agency.status
                    }
                  />
                </div>
              </div>

              <div className="rounded-lg border p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  KAI Verification
                </p>

                <div className="mt-2">
                  <Badge
                    variant={
                      verificationStatus ===
                      "VERIFIED"
                        ? "success"
                        : "secondary"
                    }
                  >
                    {verificationStatus.replace(
                      /_/g,
                      " ",
                    )}
                  </Badge>
                </div>
              </div>

              <div className="rounded-lg border p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Primary Logo
                </p>

                <p className="mt-1 font-semibold">
                  {agency.logoUrl
                    ? "Uploaded"
                    : "Not uploaded"}
                </p>
              </div>

              <div className="rounded-lg border p-4 md:col-span-2">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Registered Address
                </p>

                <p className="mt-1 font-semibold">
                  {
                    agency.officeAddress ||
                    "Not provided"
                  }
                </p>

                <p className="mt-2 text-xs text-muted-foreground">
                  This is the official agency address.
                  It is not an interview venue.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* TEAM */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Team ({teamPage.total})
            </CardTitle>

            <CardDescription>
              Everyone with access to this agency.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            {teamPage.data.map(
              (
                employee: Employee,
              ) => (
                <div
                  key={
                    employee.id
                  }
                  className="flex flex-col gap-3 border-b pb-3 text-sm last:border-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium">
                      {
                        employee.name
                      }
                    </p>

                    <p className="text-muted-foreground">
                      {
                        employee.email
                      }
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {employee.role.replace(
                        "_",
                        " ",
                      )}
                    </Badge>

                    <Badge
                      variant={
                        employee.status ===
                        "ACTIVE"
                          ? "success"
                          : "secondary"
                      }
                    >
                      {
                        employee.status
                      }
                    </Badge>
                  </div>
                </div>
              ),
            )}

            <PaginationControls
              basePath={
                APP_ROUTES.dashboardAgency
              }
              page={
                teamPage.page
              }
              totalPages={
                teamPage.totalPages
              }
              total={
                teamPage.total
              }
              pageParam="teamPage"
            />
          </CardContent>
        </Card>

        {/* JOIN REQUESTS */}
        {can(
          user,
          "join_request:review",
        ) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Pending Join Requests (
                {
                  requestsPage.total
                }
                )
              </CardTitle>

              <CardDescription>
                Employees waiting for agency approval.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-3">
              {requestsPage
                .data.length ===
                0 && (
                <p className="text-sm text-muted-foreground">
                  No pending requests.
                </p>
              )}

              {requestsPage.data.map(
                (
                  request: PendingRequest,
                ) => (
                  <div
                    key={
                      request.id
                    }
                    className="flex flex-col gap-3 border-b pb-3 text-sm last:border-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium">
                        {
                          request
                            .user
                            .name
                        }
                      </p>

                      <p className="text-muted-foreground">
                        {
                          request
                            .user
                            .email
                        }
                      </p>
                    </div>

                    <JoinRequestActions
                      joinRequestId={
                        request.id
                      }
                    />
                  </div>
                ),
              )}

              <PaginationControls
                basePath={
                  APP_ROUTES.dashboardAgency
                }
                page={
                  requestsPage.page
                }
                totalPages={
                  requestsPage.totalPages
                }
                total={
                  requestsPage.total
                }
                pageParam="requestsPage"
              />
            </CardContent>
          </Card>
        )}

        {/* CAMPAIGN CONTACTS */}
        {can(
          user,
          "advertisement:view",
        ) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Campaign Contact Directory
              </CardTitle>

              <CardDescription>
                These contacts belong to individual
                recruitment campaigns and are separate
                from permanent agency identity.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <ContactDirectoryManager
                initialContacts={
                  contacts
                }
              />
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardShell>
  );
}

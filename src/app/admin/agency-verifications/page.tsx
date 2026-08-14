import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { getCurrentUser } from "@/lib/session";
import {
  assertPermission,
  ForbiddenError,
  can,
} from "@/lib/rbac";

import {
  agencyService,
} from "@/server/services/agency.service";

import {
  agencyVerificationService,
} from "@/server/services/agency-verification.service";

import {
  generationQuotaService,
} from "@/server/services/generation-quota.service";

import {
  DashboardShell,
} from "@/components/dashboard/dashboard-shell";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  Badge,
} from "@/components/ui/badge";

import {
  AgencyVerificationActions,
} from "@/components/agency/agency-verification-actions";

import {
  AgencyQuotaGrant,
} from "@/components/agency/agency-quota-grant";

import {
  APP_ROUTES,
} from "@/lib/constants";

export const metadata: Metadata = {
  title: "Agency Verification",
};

const STATUS_VARIANT:
  Record<
    string,
    | "warning"
    | "success"
    | "destructive"
    | "secondary"
    | "outline"
  > = {
    UNVERIFIED:
      "secondary",

    VERIFIED:
      "success",

    SUSPENDED:
      "destructive",

    REVERIFICATION_REQUIRED:
      "warning",
  };

function formatStatus(
  value: string,
) {
  return value.replace(
    /_/g,
    " ",
  );
}

function getBrandBadges(
  value: unknown,
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (
      item,
    ): item is string =>
      typeof item ===
      "string" &&
      item.trim()
        .length > 0,
  );
}

/**
 * KAI SUPER ADMIN
 *
 * Agency Verification
 *
 * This page is deliberately an evidence-review screen.
 *
 * Super Admin sees:
 *
 * - Agency identity
 * - RC / MEA registration
 * - Agency logo
 * - Secondary / ISO logo
 * - Official email
 * - Official phone
 * - Official WhatsApp
 * - Registered office
 * - Permanent brand badges
 * - Verification status
 *
 * Campaign information is NOT reviewed here:
 *
 * - Job positions
 * - Salary
 * - Benefits
 * - Interview venue
 * - Campaign contact
 *
 * Those belong to individual advertisements.
 */
export default async function AgencyVerificationsPage() {
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

  try {
    assertPermission(
      user,
      "agency:verify",
    );
  } catch (error) {
    if (
      error instanceof
      ForbiddenError
    ) {
      redirect(
        APP_ROUTES.dashboard,
      );
    }

    throw error;
  }

  const [
    agencies,
    verifications,
  ] =
    await Promise.all([
      agencyService.listAll({}),

      agencyVerificationService.listAll(),
    ]);

  const verificationByAgency =
    new Map(
      verifications.map(
        (verification) => [
          verification.agencyId,
          verification,
        ],
      ),
    );

  const quotas =
    await Promise.all(
      agencies.map(
        async (
          agency,
        ) => ({
          agencyId:
            agency.id,

          quota:
            await generationQuotaService.getStatus(
              agency.id,
            ),
        }),
      ),
    );

  const quotaByAgency =
    new Map(
      quotas.map(
        (item) => [
          item.agencyId,
          item.quota,
        ],
      ),
    );

  return (
    <DashboardShell user={user}>
      {/* ================================================================ */}
      {/* PAGE HEADER                                                       */}
      {/* ================================================================ */}

      <div className="mb-8">
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-muted-foreground">
          KAI Super Admin
        </p>

        <h1 className="mt-1 text-3xl font-black tracking-tight">
          Agency Verification
        </h1>

        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Review the agency&apos;s permanent identity
          and trust information before allowing it
          to appear as verified in recruitment
          advertisements.
        </p>
      </div>

      <div className="space-y-6">
        {agencies.map(
          (agency) => {
            const verification =
              verificationByAgency.get(
                agency.id,
              );

            const status =
              verification?.status ??
              "UNVERIFIED";

            const quota =
              quotaByAgency.get(
                agency.id,
              );

            const brandBadges =
              getBrandBadges(
                agency.brandBadges,
              );

            return (
              <Card
                key={
                  agency.id
                }
              >
                {/* ====================================================== */}
                {/* HEADER                                                  */}
                {/* ====================================================== */}

                <CardHeader>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <CardTitle className="text-xl">
                        {agency.name}
                      </CardTitle>

                      <CardDescription className="mt-1">
                        RC / MEA Registration:{" "}
                        {
                          agency.registrationNumber
                        }

                        {quota
                          ? ` · ${quota.used}/${quota.totalQuota} generations used`
                          : ""}
                      </CardDescription>
                    </div>

                    <Badge
                      variant={
                        STATUS_VARIANT[
                          status
                        ] ??
                        "outline"
                      }
                    >
                      {formatStatus(
                        status,
                      )}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-6">
                  {/* ==================================================== */}
                  {/* IDENTITY EVIDENCE                                     */}
                  {/* ==================================================== */}

                  <div>
                    <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.16em] text-muted-foreground">
                      Agency Identity
                    </p>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-lg border p-4">
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Agency Name
                        </p>

                        <p className="mt-1 font-semibold">
                          {
                            agency.name
                          }
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
                          <Badge
                            variant={
                              agency.status ===
                              "APPROVED"
                                ? "success"
                                : agency.status ===
                                    "SUSPENDED"
                                  ? "destructive"
                                  : "secondary"
                            }
                          >
                            {formatStatus(
                              agency.status,
                            )}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ==================================================== */}
                  {/* LOGOS                                                  */}
                  {/* ==================================================== */}

                  <div>
                    <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.16em] text-muted-foreground">
                      Submitted Brand Assets
                    </p>

                    <div className="grid gap-4 md:grid-cols-2">
                      {/* PRIMARY LOGO */}
                      <div className="rounded-lg border p-4">
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Agency Logo
                        </p>

                        {agency.logoUrl ? (
                          <div className="mt-4 flex min-h-32 items-center justify-center rounded-md bg-muted p-4">
                            <img
                              src={
                                agency.logoUrl
                              }
                              alt={`${agency.name} agency logo`}
                              className="max-h-24 max-w-full object-contain"
                            />
                          </div>
                        ) : (
                          <div className="mt-4 rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                            No agency logo submitted.
                          </div>
                        )}
                      </div>

                      {/* SECONDARY / ISO LOGO */}
                      <div className="rounded-lg border p-4">
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          ISO / Secondary Logo
                        </p>

                        {agency.secondaryLogoUrl ? (
                          <div className="mt-4 flex min-h-32 items-center justify-center rounded-md bg-muted p-4">
                            <img
                              src={
                                agency.secondaryLogoUrl
                              }
                              alt={`${agency.name} secondary certification logo`}
                              className="max-h-24 max-w-full object-contain"
                            />
                          </div>
                        ) : (
                          <div className="mt-4 rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                            No secondary logo submitted.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ==================================================== */}
                  {/* PERMANENT CREDENTIALS                                 */}
                  {/* ==================================================== */}

                  <div>
                    <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.16em] text-muted-foreground">
                      Permanent Agency Credentials
                    </p>

                    <div className="rounded-lg border p-4">
                      {brandBadges.length >
                      0 ? (
                        <div className="flex flex-wrap gap-2">
                          {brandBadges.map(
                            (
                              badge,
                              index,
                            ) => (
                              <Badge
                                key={`${badge}-${index}`}
                                variant="outline"
                              >
                                {
                                  badge
                                }
                              </Badge>
                            ),
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          No permanent credentials submitted.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* ==================================================== */}
                  {/* OFFICIAL CONTACT                                      */}
                  {/* ==================================================== */}

                  <div>
                    <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.16em] text-muted-foreground">
                      Official Agency Contact
                    </p>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-lg border p-4">
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Contact Person
                        </p>

                        <p className="mt-1 font-semibold">
                          {
                            agency.contactPerson ||
                            "Not provided"
                          }
                        </p>
                      </div>

                      <div className="rounded-lg border p-4">
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Official Phone
                        </p>

                        <p className="mt-1 font-semibold">
                          {
                            agency.phone ||
                            "Not provided"
                          }
                        </p>
                      </div>

                      <div className="rounded-lg border p-4">
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Official WhatsApp
                        </p>

                        <p className="mt-1 font-semibold">
                          {
                            agency.whatsapp ||
                            "Not provided"
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

                      <div className="rounded-lg border p-4 md:col-span-2">
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Official Website
                        </p>

                        <p className="mt-1 break-all font-semibold">
                          {
                            agency.website
                          }
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* ==================================================== */}
                  {/* REGISTERED ADDRESS                                    */}
                  {/* ==================================================== */}

                  <div>
                    <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.16em] text-muted-foreground">
                      Registered Office
                    </p>

                    <div className="rounded-lg border p-4">
                      <p className="font-semibold">
                        {
                          agency.officeAddress ||
                          "Not provided"
                        }
                      </p>

                      <p className="mt-2 text-xs text-muted-foreground">
                        This is the permanent registered
                        agency address. It is not an
                        interview venue.
                      </p>
                    </div>
                  </div>

                  {/* ==================================================== */}
                  {/* VERIFICATION EVIDENCE                                 */}
                  {/* ==================================================== */}

                  {verification && (
                    <div>
                      <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.16em] text-muted-foreground">
                        Verification Record
                      </p>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-lg border p-4">
                          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            Verification Status
                          </p>

                          <p className="mt-1 font-semibold">
                            {formatStatus(
                              verification.status,
                            )}
                          </p>
                        </div>

                        <div className="rounded-lg border p-4">
                          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            Verification Date
                          </p>

                          <p className="mt-1 font-semibold">
                            {verification.verificationDate
                              ? verification.verificationDate.toLocaleDateString(
                                  "en-IN",
                                )
                              : "Not verified"}
                          </p>
                        </div>

                        <div className="rounded-lg border p-4 md:col-span-2">
                          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            Official Verification URL
                          </p>

                          <p className="mt-1 break-all text-sm font-semibold">
                            {
                              verification.officialVerificationUrl ||
                              "Not provided"
                            }
                          </p>
                        </div>

                        {verification.notes && (
                          <div className="rounded-lg border p-4 md:col-span-2">
                            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                              Verification Notes
                            </p>

                            <p className="mt-1 text-sm">
                              {
                                verification.notes
                              }
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ==================================================== */}
                  {/* ACTIONS                                                */}
                  {/* ==================================================== */}

                  <div className="border-t pt-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className="font-semibold">
                          Trust Decision
                        </p>

                        <p className="mt-1 text-sm text-muted-foreground">
                          Verify only after checking the
                          submitted agency identity and
                          supporting evidence.
                        </p>
                      </div>

                      <AgencyVerificationActions
                        agencyId={
                          agency.id
                        }
                        status={
                          verification?.status ??
                          null
                        }
                      />
                    </div>
                  </div>

                  {/* ==================================================== */}
                  {/* QUOTA                                                 */}
                  {/* ==================================================== */}

                  {can(
                    user,
                    "agency:manage_quota",
                  ) && (
                    <div className="border-t pt-5">
                      <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.16em] text-muted-foreground">
                        Generation Quota
                      </p>

                      <AgencyQuotaGrant
                        agencyId={
                          agency.id
                        }
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          },
        )}

        {agencies.length ===
          0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="font-semibold">
                No agencies found.
              </p>

              <p className="mt-1 text-sm text-muted-foreground">
                There are currently no agency records
                available for verification.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardShell>
  );
}

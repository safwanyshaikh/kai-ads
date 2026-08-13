import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/session";
import { can } from "@/lib/rbac";
import { advertisementService } from "@/server/services/advertisement.service";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AdvertisementStatusBadge } from "@/components/advertisement/advertisement-status-badge";
import { AdvertisementDetailActions } from "@/components/advertisement/advertisement-detail-actions";
import { AdvertisementCanvas } from "@/components/advertisement/advertisement-canvas";
import { GenerationPanel } from "@/components/advertisement/generation-panel";
import { APP_ROUTES } from "@/lib/constants";
import type { CreateAdvertisementInput } from "@/lib/validations/advertisement";

export const metadata: Metadata = {
  title: "Advertisement",
};

function cleanCampaignTitle(
  header: string,
): string {
  const trimmed =
    header.trim();

  if (!trimmed) {
    return "RECRUITMENT CAMPAIGN";
  }

  /**
   * KAI campaign title:
   *
   * "Saudi Aramco Projects — Saudi Arabia"
   *
   * becomes:
   *
   * "Saudi Aramco Projects"
   *
   * Country belongs in the second line.
   */
  return trimmed
    .split("—")[0]
    .trim()
    .replace(/\s+/g, " ");
}

function totalVacancies(
  positions: CreateAdvertisementInput["positions"],
): number {
  return positions.reduce(
    (sum, position) =>
      sum +
      (position.count ?? 0),
    0,
  );
}

export default async function AdvertisementDetailPage({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
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

  if (
    !can(
      user,
      "advertisement:view",
    ) ||
    !user.agencyId
  ) {
    redirect(
      APP_ROUTES.dashboard,
    );
  }

  const { id } =
    await params;

  const [
    advertisement,
    versions,
    history,
  ] = await Promise.all([
    advertisementService.getById(
      id,
      user.agencyId,
      true,
    ),
    advertisementService.listVersions(
      id,
      user.agencyId,
    ),
    advertisementService.listHistory(
      id,
      user.agencyId,
    ),
  ]);

  const previewData: CreateAdvertisementInput =
    {
      header:
        advertisement.header,

      industry:
        advertisement.industry,

      country:
        advertisement.country,

      employer:
        advertisement.employer ??
        undefined,

      positions:
        advertisement.positions as CreateAdvertisementInput["positions"],

      benefits:
        advertisement.benefits as CreateAdvertisementInput["benefits"],

      interview:
        advertisement.interview as CreateAdvertisementInput["interview"],

      contact:
        advertisement.contact as CreateAdvertisementInput["contact"],

      footer:
        advertisement.footer ??
        undefined,

      theme:
        advertisement.theme as CreateAdvertisementInput["theme"],

      style:
        advertisement.style,
    };

  const campaignTitle =
    cleanCampaignTitle(
      previewData.header,
    );

  const vacancyCount =
    totalVacancies(
      previewData.positions,
    );

  const roleCount =
    previewData.positions
      .length;

  const campaignMeta =
    [
      previewData.country,
      previewData.industry,
    ]
      .filter(Boolean)
      .join(
        " · ",
      );

  return (
    <DashboardShell user={user}>
      <div className="mb-8 flex items-start justify-between gap-6">
        <div className="min-w-0">
          <h1 className="text-3xl font-black uppercase tracking-tight">
            {campaignTitle}
          </h1>

          <p className="mt-1 text-base font-semibold uppercase tracking-wide text-muted-foreground">
            {campaignMeta || "RECRUITMENT CAMPAIGN"}
          </p>

          <p className="mt-2 text-sm font-bold uppercase tracking-wide text-primary">
            {vacancyCount > 0
              ? `${vacancyCount} VACANCIES`
              : "RECRUITMENT OPPORTUNITY"}
            {" · "}
            {roleCount}{" "}
            {roleCount === 1
              ? "ROLE"
              : "ROLES"}
            {" · "}
            VERSION{" "}
            {advertisement.currentVersion}
            {advertisement.deletedAt
              ? " · DELETED"
              : ""}
          </p>
        </div>

        <AdvertisementStatusBadge
          status={
            advertisement.status
          }
        />
      </div>

      {can(
        user,
        "advertisement:edit",
      ) && (
        <div className="mb-6">
          <AdvertisementDetailActions
            id={
              advertisement.id
            }
            status={
              advertisement.status
            }
          />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <AdvertisementCanvas
            advertisementId={
              advertisement.id
            }
            data={
              previewData
            }
            canEdit={
              can(
                user,
                "advertisement:edit",
              ) &&
              !advertisement.deletedAt
            }
          />

          {can(
            user,
            "advertisement:generate",
          ) && (
            <GenerationPanel
              advertisementId={
                advertisement.id
              }
              generatedAssetUrl={
                advertisement.generatedAssetUrl
              }
              trustStatus={
                advertisement.trustStatus
              }
              trustWarnings={
                (advertisement.trustWarnings as string[] | null) ??
                []
              }
            />
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Version History
              </CardTitle>

              <CardDescription>
                {versions.length}{" "}
                {versions.length ===
                1
                  ? "version"
                  : "versions"}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-2 text-sm">
              {versions.map(
                (version) => (
                  <div
                    key={
                      version.id
                    }
                    className="border-b pb-2 last:border-0 last:pb-0"
                  >
                    <p className="font-medium">
                      v
                      {
                        version.versionNumber
                      }
                    </p>

                    <p className="text-muted-foreground">
                      {version.changeSummary ||
                        "No summary"}
                    </p>
                  </div>
                ),
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                History
              </CardTitle>

              <CardDescription>
                {history.length}{" "}
                {history.length ===
                1
                  ? "event"
                  : "events"}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-2 text-sm">
              {history.map(
                (entry) => (
                  <div
                    key={
                      entry.id
                    }
                    className="border-b pb-2 last:border-0 last:pb-0"
                  >
                    <p className="font-medium">
                      {entry.action.replace(
                        /_/g,
                        " ",
                      )}
                    </p>

                    {entry.fromStatus &&
                      entry.toStatus && (
                        <p className="text-muted-foreground">
                          {
                            entry.fromStatus
                          }{" "}
                          →{" "}
                          {
                            entry.toStatus
                          }
                        </p>
                      )}
                  </div>
                ),
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}

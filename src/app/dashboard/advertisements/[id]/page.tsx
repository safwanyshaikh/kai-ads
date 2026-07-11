import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/session";
import { can } from "@/lib/rbac";
import { advertisementService } from "@/server/services/advertisement.service";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AdvertisementStatusBadge } from "@/components/advertisement/advertisement-status-badge";
import { AdvertisementDetailActions } from "@/components/advertisement/advertisement-detail-actions";
import { AdvertisementPreview } from "@/components/advertisement/advertisement-preview";
import { GenerationPanel } from "@/components/advertisement/generation-panel";
import { APP_ROUTES } from "@/lib/constants";
import type { CreateAdvertisementInput } from "@/lib/validations/advertisement";

export const metadata: Metadata = { title: "Advertisement" };

/** Advertisement detail — content, version history, lifecycle actions. */
export default async function AdvertisementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect(APP_ROUTES.login);
  if (user.status === "PENDING") redirect(APP_ROUTES.pendingApproval);
  if (!can(user, "advertisement:view") || !user.agencyId) redirect(APP_ROUTES.dashboard);

  const { id } = await params;
  const [advertisement, versions, history] = await Promise.all([
    advertisementService.getById(id, user.agencyId, true),
    advertisementService.listVersions(id, user.agencyId),
    advertisementService.listHistory(id, user.agencyId),
  ]);

  type VersionEntry = (typeof versions)[number];
  type HistoryEntry = (typeof history)[number];

  const previewData: CreateAdvertisementInput = {
    header: advertisement.header,
    industry: advertisement.industry,
    country: advertisement.country,
    employer: advertisement.employer ?? undefined,
    positions: advertisement.positions as CreateAdvertisementInput["positions"],
    benefits: advertisement.benefits as CreateAdvertisementInput["benefits"],
    interview: advertisement.interview as CreateAdvertisementInput["interview"],
    contact: advertisement.contact as CreateAdvertisementInput["contact"],
    footer: advertisement.footer ?? undefined,
    theme: advertisement.theme as CreateAdvertisementInput["theme"],
    style: advertisement.style,
  };

  return (
    <DashboardShell user={user}>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{advertisement.header}</h1>
          <p className="text-muted-foreground">
            Version {advertisement.currentVersion}
            {advertisement.deletedAt ? " · Deleted (in trash)" : ""}
          </p>
        </div>
        <AdvertisementStatusBadge status={advertisement.status} />
      </div>

      {can(user, "advertisement:edit") && (
        <div className="mb-6">
          <AdvertisementDetailActions id={advertisement.id} status={advertisement.status} />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <AdvertisementPreview data={previewData} />
          {can(user, "advertisement:generate") && (
            <GenerationPanel
              advertisementId={advertisement.id}
              currentStyle={advertisement.style}
              generatedAssetUrl={advertisement.generatedAssetUrl}
              trustStatus={advertisement.trustStatus}
              trustWarnings={(advertisement.trustWarnings as string[] | null) ?? []}
            />
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Version History</CardTitle>
              <CardDescription>{versions.length} version{versions.length === 1 ? "" : "s"}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {versions.map((v: VersionEntry) => (
                <div key={v.id} className="border-b pb-2 last:border-0 last:pb-0">
                  <p className="font-medium">v{v.versionNumber}</p>
                  <p className="text-muted-foreground">{v.changeSummary || "No summary"}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">History</CardTitle>
              <CardDescription>{history.length} event{history.length === 1 ? "" : "s"}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {history.map((h: HistoryEntry) => (
                <div key={h.id} className="border-b pb-2 last:border-0 last:pb-0">
                  <p className="font-medium">{h.action.replace(/_/g, " ")}</p>
                  {h.fromStatus && h.toStatus && (
                    <p className="text-muted-foreground">
                      {h.fromStatus} → {h.toStatus}
                    </p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}

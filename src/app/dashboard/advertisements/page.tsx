import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/session";
import { can } from "@/lib/rbac";
import { advertisementService } from "@/server/services/advertisement.service";
import { generationQuotaService } from "@/server/services/generation-quota.service";
import { advertisementSearchQuerySchema } from "@/lib/validations/advertisement";
import { parsePagination } from "@/lib/pagination";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AdvertisementStatusBadge } from "@/components/advertisement/advertisement-status-badge";
import { AdvertisementRowActions } from "@/components/advertisement/advertisement-row-actions";
import { AdvertisementSearchBar } from "@/components/advertisement/advertisement-search-bar";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { APP_ROUTES } from "@/lib/constants";

export const metadata: Metadata = { title: "Advertisement Library" };

/** Advertisement Library — Sprint 002: search, filters, pagination, duplicate/archive/restore/delete. */
export default async function AdvertisementLibraryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect(APP_ROUTES.login);
  if (user.status === "PENDING") redirect(APP_ROUTES.pendingApproval);
  if (!can(user, "advertisement:view") || !user.agencyId) redirect(APP_ROUTES.dashboard);

  const params = await searchParams;
  const query = advertisementSearchQuerySchema.parse({
    q: params.q || undefined,
    status: params.status || undefined,
    industry: params.industry || undefined,
    country: params.country || undefined,
  });
  const pagination = parsePagination(params);

  const result = await advertisementService.list({ agencyId: user.agencyId, ...query }, pagination);
  const quota = await generationQuotaService.getStatus(user.agencyId);

  return (
    <DashboardShell user={user}>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Advertisement Library</h1>
          <p className="text-muted-foreground">{result.total} advertisement{result.total === 1 ? "" : "s"}</p>
        </div>
        {can(user, "advertisement:create") && (
          <Button asChild>
            <Link href={APP_ROUTES.advertisementNew}>Create Advertisement</Link>
          </Button>
        )}
      </div>

      <div className="mb-6">
        <AdvertisementSearchBar q={query.q} status={query.status} industry={query.industry} country={query.country} />
      </div>

      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
          <div>
            <p className="text-sm font-medium">Free Trial Generations</p>
            <p className="text-xs text-muted-foreground">Shared across every employee at your agency.</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={quota.remaining > 0 ? "success" : "destructive"}>
              {quota.remaining} of {quota.totalQuota} remaining
            </Badge>
            <span className="text-xs text-muted-foreground">{quota.used} used</span>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {result.data.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              No advertisements match your filters yet.
            </CardContent>
          </Card>
        )}

        {result.data.map((ad) => (
          <Card key={ad.id}>
            <CardHeader className="flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="text-base">
                  <Link href={APP_ROUTES.advertisementDetail(ad.id)} className="hover:underline">
                    {ad.header}
                  </Link>
                </CardTitle>
                <CardDescription>
                  {ad.industry} · {ad.country}
                  {ad.employer ? ` · ${ad.employer}` : ""} · v{ad.currentVersion}
                </CardDescription>
              </div>
              <AdvertisementStatusBadge status={ad.status} />
            </CardHeader>
            <CardContent>
              <AdvertisementRowActions id={ad.id} status={ad.status} />
            </CardContent>
          </Card>
        ))}

        <PaginationControls
          basePath={APP_ROUTES.advertisements}
          page={result.page}
          totalPages={result.totalPages}
          total={result.total}
        />
      </div>
    </DashboardShell>
  );
}

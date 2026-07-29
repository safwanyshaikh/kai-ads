import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { assertPermission, ForbiddenError } from "@/lib/rbac";
import { intelligenceReportService, type ReportPeriod } from "@/server/services/intelligence-report.service";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_ROUTES } from "@/lib/constants";

export const metadata: Metadata = { title: "Intelligence Report" };

function List({ rows, empty }: { rows: { label: string; count: number }[]; empty: string }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="divide-y">
      {rows.map((r) => (
        <li key={r.label} className="flex justify-between py-2 text-sm">
          <span>{r.label}</span>
          <span className="text-muted-foreground">{r.count}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Weekly and Monthly Intelligence Reports — Platform Admin only.
 * Read-only: nothing here changes production behaviour.
 */
export default async function IntelligencePage({
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
  const period: ReportPeriod = params.period === "monthly" ? "monthly" : "weekly";
  const r = await intelligenceReportService.generate(period);
  const avg = r.generation.averageMs != null ? `${(r.generation.averageMs / 1000).toFixed(1)}s` : "—";

  return (
    <DashboardShell user={user}>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            {period === "weekly" ? "Weekly" : "Monthly"} Intelligence Report
          </h1>
          <p className="text-sm text-muted-foreground">
            {r.from.toLocaleDateString()} – {r.to.toLocaleDateString()}. Platform analytics only; no
            production behaviour changes from this page.
          </p>
        </div>
        <div className="flex gap-3 text-sm">
          <Link href="?period=weekly" className={period === "weekly" ? "font-semibold" : "text-muted-foreground"}>
            Weekly
          </Link>
          <Link href="?period=monthly" className={period === "monthly" ? "font-semibold" : "text-muted-foreground"}>
            Monthly
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardDescription>Agencies registered</CardDescription></CardHeader><CardContent><p className="text-2xl font-semibold">{r.adoption.agenciesRegistered}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Agencies generating</CardDescription></CardHeader><CardContent><p className="text-2xl font-semibold">{r.adoption.agenciesGenerating}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Advertisements generated</CardDescription></CardHeader><CardContent><p className="text-2xl font-semibold">{r.generation.succeeded}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Success rate</CardDescription></CardHeader><CardContent><p className="text-2xl font-semibold">{r.generation.successRatePct != null ? `${r.generation.successRatePct}%` : "—"}</p><p className="mt-1 text-xs text-muted-foreground">{r.generation.failed} failed · avg {avg}</p></CardContent></Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Where demand is</CardTitle><CardDescription>Most requested industries and destinations.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Industries</p>
              <List rows={r.demand.industries} empty="No advertisements in this period." />
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Countries</p>
              <List rows={r.demand.countries} empty="No advertisements in this period." />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">AI provider performance</CardTitle><CardDescription>Latency and cost by provider and model — the input to any provider change.</CardDescription></CardHeader>
          <CardContent>
            {r.providers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No generations in this period.</p>
            ) : (
              <ul className="divide-y">
                {r.providers.map((p) => (
                  <li key={`${p.provider}-${p.model}`} className="py-2 text-sm">
                    <div className="flex justify-between">
                      <span className="font-medium">{p.model}</span>
                      <span className="text-muted-foreground">{p.runs} runs</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {p.provider} · avg {p.averageMs != null ? `${(p.averageMs / 1000).toFixed(1)}s` : "—"}
                      {p.costUsd != null && ` · $${p.costUsd.toFixed(4)}`}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Candidate reach</CardTitle><CardDescription>QR scans and where they came from.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-2xl font-semibold">{r.reach.qrScans}</p>
            <List rows={r.reach.topPlatforms} empty="No QR scans recorded in this period." />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Most active agencies</CardTitle><CardDescription>Who to talk to about the next phase.</CardDescription></CardHeader>
          <CardContent>
            <List rows={r.mostActive.map((a) => ({ label: a.agencyName, count: a.generated }))} empty="No agency has generated yet." />
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}

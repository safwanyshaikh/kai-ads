import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/session";
import { assertPermission, ForbiddenError } from "@/lib/rbac";
import { betaMetricsService } from "@/server/services/beta-metrics.service";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { APP_ROUTES } from "@/lib/constants";

export const metadata: Metadata = { title: "Closed Beta" };

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

/**
 * Closed Beta operations view — the twenty-agency cohort at a glance.
 * Read-only aggregates over existing tables; no new data is recorded.
 */
export default async function AdminBetaPage() {
  const user = await getCurrentUser();
  if (!user) redirect(APP_ROUTES.login);
  if (user.status === "PENDING") redirect(APP_ROUTES.pendingApproval);

  try {
    assertPermission(user, "agency:view_all");
  } catch (error) {
    if (error instanceof ForbiddenError) redirect(APP_ROUTES.dashboard);
    throw error;
  }

  const m = await betaMetricsService.get();
  const avgSeconds =
    m.advertisements.averageGenerationMs != null
      ? `${(m.advertisements.averageGenerationMs / 1000).toFixed(1)}s`
      : "—";

  return (
    <DashboardShell user={user}>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold">Closed Beta</h1>
        <p className="text-sm text-muted-foreground">
          Twenty agencies, 50 complimentary advertisements each.
        </p>
      </div>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Agencies
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Stat label="Registered" value={m.agencies.total} />
          <Stat label="Pending approval" value={m.agencies.pending} hint="Awaiting review" />
          <Stat label="Approved" value={m.agencies.approved} hint="of 20 beta places" />
          <Stat label="Actively generating" value={m.agencies.active} hint="≥1 advertisement" />
          <Stat label="Suspended" value={m.agencies.suspended} />
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Complimentary credits
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Granted" value={m.credits.granted} />
          <Stat label="Used" value={m.credits.used} />
          <Stat label="Remaining" value={m.credits.remaining} />
          <Stat
            label="Allocation complete"
            value={m.credits.exhausted}
            hint="Agencies to contact about the next phase"
          />
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Advertisements
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Created" value={m.advertisements.total} />
          <Stat label="Generated" value={m.advertisements.generated} />
          <Stat
            label="Failed generations"
            value={m.advertisements.failed}
            hint="Investigate before contacting the agency"
          />
          <Stat label="Average generation" value={avgSeconds} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Most active agencies
        </h2>
        <Card>
          <CardContent className="pt-6">
            {m.mostActive.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No agency has generated an advertisement yet.
              </p>
            ) : (
              <ul className="divide-y">
                {m.mostActive.map((a) => (
                  <li key={a.agencyName} className="flex items-center justify-between py-2 text-sm">
                    <span className="font-medium">{a.agencyName}</span>
                    <span className="text-muted-foreground">
                      {a.generated} generated · {a.remaining} remaining
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </DashboardShell>
  );
}

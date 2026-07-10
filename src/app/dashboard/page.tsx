import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/session";
import { can } from "@/lib/rbac";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { APP_ROUTES } from "@/lib/constants";

export const metadata: Metadata = { title: "Dashboard" };

/**
 * Dashboard — Sprint 001 placeholder, Create Advertisement + Advertisement
 * Library enabled in Sprint 002. No AI image generation, export, or
 * rendering yet — see project/SPRINTERS/SPRINT_002.md.
 */
export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect(APP_ROUTES.login);
  if (user.status === "PENDING") redirect(APP_ROUTES.pendingApproval);

  return (
    <DashboardShell user={user}>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Welcome back, {user.name}</h1>
        <p className="text-muted-foreground">
          Here&apos;s an overview of your KAI Ads workspace.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {can(user, "advertisement:create") && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Create Advertisement</CardTitle>
              <CardDescription>
                Paste a requirement or upload a PDF, DOCX, image, or WhatsApp
                screenshot to start a new advertisement.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild size="sm">
                <Link href={APP_ROUTES.advertisementNew}>Get Started</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {can(user, "advertisement:view") && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Advertisement Library</CardTitle>
              <CardDescription>Search, filter, and manage every advertisement.</CardDescription>
            </CardHeader>
            <CardContent>
              <a href={APP_ROUTES.advertisements} className="text-sm font-medium text-primary hover:underline">
                View library →
              </a>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Credits</CardTitle>
            <CardDescription>One advertisement equals one credit.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">—</p>
            <p className="text-xs text-muted-foreground">Credit system arrives in a later sprint.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Agency Profile</CardTitle>
            <CardDescription>Manage your agency&apos;s details and team.</CardDescription>
          </CardHeader>
          <CardContent>
            <a href={APP_ROUTES.dashboardAgency} className="text-sm font-medium text-primary hover:underline">
              View agency →
            </a>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contacts</CardTitle>
            <CardDescription>Saved candidates and employer contacts.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Arrives in a later sprint.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Subscription</CardTitle>
            <CardDescription>Your current plan and billing.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Arrives in a later sprint.</p>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}

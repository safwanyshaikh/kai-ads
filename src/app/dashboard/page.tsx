import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/session";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { APP_ROUTES } from "@/lib/constants";

export const metadata: Metadata = { title: "Dashboard" };

/**
 * Screen 5 — Dashboard Placeholder (Sprint 001).
 * Cards: Create Advertisement (disabled), Credits, Agency Profile,
 * Contacts, Subscription. No advertisement engine in this sprint.
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
        <Card className="opacity-60">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Create Advertisement</CardTitle>
              <Badge variant="secondary">Coming Soon</Badge>
            </div>
            <CardDescription>
              Generate a recruitment advertisement from text, PDF, DOCX, or a
              pasted WhatsApp/email message.
            </CardDescription>
          </CardHeader>
        </Card>

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

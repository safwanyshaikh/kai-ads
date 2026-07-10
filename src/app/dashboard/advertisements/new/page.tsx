import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/session";
import { can } from "@/lib/rbac";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { CreateAdvertisementForm } from "@/components/advertisement/create-advertisement-form";
import { APP_ROUTES } from "@/lib/constants";

export const metadata: Metadata = { title: "Create Advertisement" };

/** Create Advertisement — choose an input method (Sprint 002). */
export default async function NewAdvertisementPage() {
  const user = await getCurrentUser();
  if (!user) redirect(APP_ROUTES.login);
  if (user.status === "PENDING") redirect(APP_ROUTES.pendingApproval);
  if (!can(user, "advertisement:create")) redirect(APP_ROUTES.dashboard);

  return (
    <DashboardShell user={user}>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Create Advertisement</h1>
        <p className="text-muted-foreground">
          Paste a requirement or upload a source file to get started.
        </p>
      </div>
      <CreateAdvertisementForm />
    </DashboardShell>
  );
}

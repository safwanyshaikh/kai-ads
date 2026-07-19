import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/session";
import { can } from "@/lib/rbac";
import { advertisementDraftService } from "@/server/services/advertisement-draft.service";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { DraftWorkspace } from "@/components/advertisement/draft-workspace";
import { APP_ROUTES } from "@/lib/constants";

export const metadata: Metadata = { title: "Create Advertisement" };

/** Sprint 006 workflow: AI Extraction -> auto-create -> auto-generate -> Advertisement Canvas. No review form. */
export default async function AdvertisementDraftPage({
  params,
}: {
  params: Promise<{ draftId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect(APP_ROUTES.login);
  if (user.status === "PENDING") redirect(APP_ROUTES.pendingApproval);
  if (!can(user, "advertisement:create") || !user.agencyId) redirect(APP_ROUTES.dashboard);

  const { draftId } = await params;
  const draft = await advertisementDraftService.getById(draftId, user.agencyId);

  if (draft.status === "SAVED" || draft.status === "DISCARDED") {
    redirect(APP_ROUTES.advertisements);
  }

  return (
    <DashboardShell user={user}>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Create Advertisement</h1>
        <p className="text-muted-foreground">
          KAI is reading the requirement and building the advertisement for you.
        </p>
      </div>
      <DraftWorkspace
        draftId={draft.id}
        sourceType={draft.sourceType}
        hasRawText={Boolean(draft.rawText)}
        initialStatus={draft.status}
      />
    </DashboardShell>
  );
}

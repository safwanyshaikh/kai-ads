import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/session";
import { can } from "@/lib/rbac";
import { APP_ROUTES } from "@/lib/constants";
import { fatValidationService } from "@/server/services/fat-validation.service";
import { FAT_SAMPLES } from "@/server/fat-samples";
import { FatValidationClient } from "./fat-validation-client";

export const metadata: Metadata = { title: "FAT — Founder Validation" };

/**
 * /internal/fat — Task 006.5, the Founder validation page.
 *
 * NOT a product feature. Exposes the completed, locked Intelligence
 * Layer (Tasks 001-006) for direct testing with real recruitment inputs
 * — nothing more. KAI_SUPER_ADMIN only.
 */
export default async function FatValidationPage() {
  const user = await getCurrentUser();
  if (!user) redirect(APP_ROUTES.login);
  if (!can(user, "fat:access")) redirect(APP_ROUTES.dashboard);

  const runs = await fatValidationService.listRuns();

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="text-xl font-semibold">Founder Acceptance Testing — Intelligence Layer</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Tasks 001–006, unmodified. Paste a real requirement, upload a file, or provide a public URL, then Run.
        Every engine&apos;s decision is shown with its confidence, reason, and source.
      </p>

      <FatValidationClient samples={FAT_SAMPLES} initialRuns={runs} />
    </div>
  );
}

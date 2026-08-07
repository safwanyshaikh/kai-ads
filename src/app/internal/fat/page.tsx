import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/session";
import { APP_ROUTES } from "@/lib/constants";
import { FatWorkspace } from "@/components/fat/fat-workspace";

export const metadata: Metadata = { title: "Founder Validation — KAI Ads" };

/**
 * Task 006.5 — /internal/fat, the permanent Founder Acceptance Testing
 * console. Same redirect pattern as /admin/beta (Task 006): signed-out ->
 * /login, signed-in-but-wrong-role -> /dashboard. The role check itself
 * lives in server/fat/guard.ts, independent of the Task 001 RBAC matrix —
 * see that file's comment for why.
 */
export default async function FounderValidationPage() {
  const user = await getCurrentUser();
  if (!user) redirect(APP_ROUTES.login);
  if (user.role !== "KAI_SUPER_ADMIN") redirect(APP_ROUTES.dashboard);

  return <FatWorkspace founderEmail={user.email} />;
}

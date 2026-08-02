import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/session";
import { can } from "@/lib/rbac";
import { APP_ROUTES } from "@/lib/constants";
import { computeFatHealth } from "@/server/fat-health";

export const metadata: Metadata = { title: "FAT — Health" };

/**
 * /internal/fat/health — Task 006.5 requirement 6.
 *
 * Green/red only, server-rendered directly (no client JS, no extra
 * fetch) — this is the page a Founder or an uptime check opens first,
 * before anything else on the validation bridge.
 */
export default async function FatHealthPage() {
  const user = await getCurrentUser();
  if (!user) redirect(APP_ROUTES.login);
  if (!can(user, "fat:access")) redirect(APP_ROUTES.dashboard);

  const health = await computeFatHealth();
  const checks: { label: string; ok: boolean }[] = [
    { label: "Database", ok: health.database },
    { label: "AI Provider", ok: health.aiProvider },
    { label: "Storage", ok: health.storage },
    { label: "Authentication", ok: health.authentication },
    { label: "Environment", ok: health.environment },
  ];

  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="text-xl font-semibold">FAT Health</h1>
      <ul className="mt-4 space-y-2">
        {checks.map((check) => (
          <li key={check.label} className="flex items-center justify-between border-b py-2 text-sm">
            <span>{check.label}</span>
            <span className={check.ok ? "text-green-600" : "text-red-600"}>{check.ok ? "GREEN" : "RED"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

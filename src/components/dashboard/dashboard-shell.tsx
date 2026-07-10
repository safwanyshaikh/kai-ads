import Link from "next/link";
import type { ReactNode } from "react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { APP_ROUTES } from "@/lib/constants";
import type { CurrentUser } from "@/lib/session";
import { can } from "@/lib/rbac";

export function DashboardShell({
  user,
  children,
}: {
  user: CurrentUser;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-muted/20">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-6">
            <Link href={APP_ROUTES.dashboard} className="text-lg font-bold tracking-tight">
              KAI Ads
            </Link>
            <nav className="flex items-center gap-4 text-sm text-muted-foreground">
              <Link href={APP_ROUTES.dashboard} className="hover:text-foreground">
                Dashboard
              </Link>
              {can(user, "advertisement:view") && (
                <Link href={APP_ROUTES.advertisements} className="hover:text-foreground">
                  Advertisements
                </Link>
              )}
              {can(user, "agency:manage_own") && (
                <Link href={APP_ROUTES.dashboardAgency} className="hover:text-foreground">
                  Agency
                </Link>
              )}
              {can(user, "agency:view_all") && (
                <Link href={APP_ROUTES.adminAgencies} className="hover:text-foreground">
                  Agency Approvals
                </Link>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{user.name}</span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}

import "server-only";
import { getCurrentUser, type CurrentUser } from "@/lib/session";
import { UnauthorizedError } from "@/lib/errors";
import { ForbiddenError } from "@/lib/rbac";

/**
 * Task 006.5 — Founder Acceptance Testing guard.
 *
 * KAI_SUPER_ADMIN has no agencyId and no advertisement:* permission in
 * the Task 001 RBAC matrix (src/lib/rbac.ts, unmodified by this file),
 * so the Founder's own account cannot pass `requireAgencyMember` — every
 * existing draft/advertisement route is structurally closed to them.
 * This guard is deliberately independent of that matrix rather than an
 * addition to it: it imports the existing `getCurrentUser()` unmodified
 * and checks the role directly, so /internal/fat's authorization has no
 * way to accidentally loosen what agency members can do.
 */
export async function requireFounder(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  if (user.role !== "KAI_SUPER_ADMIN") {
    throw new ForbiddenError("This page is restricted to the KAI Super Admin (Founder) account.");
  }
  return user;
}

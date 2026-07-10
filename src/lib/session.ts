import "server-only";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { AppError, UnauthorizedError } from "@/lib/errors";
import { assertPermission, type AuthorizableUser, type Permission } from "@/lib/rbac";

export interface CurrentUser extends AuthorizableUser {
  id: string;
  name: string;
  email: string;
}

/** Reads the Better Auth session for the current request. Null if signed out. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;

  const user = session.user as typeof session.user & {
    role: CurrentUser["role"];
    status: CurrentUser["status"];
    agencyId: string | null;
  };

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    agencyId: user.agencyId ?? null,
  };
}

/** Throws UnauthorizedError if not signed in. Use at the top of protected API routes. */
export async function requireCurrentUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

/**
 * Combines the three checks every tenant-scoped route needs: signed in,
 * has the given permission, and belongs to an agency (so `agencyId` is
 * always non-null and always session-derived — never trusted from the
 * client). Use this instead of hand-rolling requireCurrentUser() +
 * assertPermission() + a null check in every advertisement route.
 */
export async function requireAgencyMember(
  permission: Permission,
): Promise<CurrentUser & { agencyId: string }> {
  const user = await requireCurrentUser();
  assertPermission(user, permission);
  if (!user.agencyId) {
    throw new AppError("You are not associated with an agency.", 400);
  }
  return user as CurrentUser & { agencyId: string };
}

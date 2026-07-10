import "server-only";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { UnauthorizedError } from "@/lib/errors";
import type { AuthorizableUser } from "@/lib/rbac";

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

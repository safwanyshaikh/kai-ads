import type { UserRole, UserStatus } from "@prisma/client";

/**
 * RBAC — Sprint 001 defines three roles:
 *   KAI_SUPER_ADMIN  — approves/rejects/suspends/activates agencies
 *   AGENCY_ADMIN     — manages own agency, approves employee join requests
 *   AGENCY_USER      — regular employee, dashboard access only
 */

export type Permission =
  | "agency:approve"
  | "agency:reject"
  | "agency:suspend"
  | "agency:activate"
  | "agency:view_all"
  | "agency:manage_own"
  | "join_request:review"
  | "join_request:create"
  | "dashboard:view";

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  KAI_SUPER_ADMIN: [
    "agency:approve",
    "agency:reject",
    "agency:suspend",
    "agency:activate",
    "agency:view_all",
    "dashboard:view",
  ],
  AGENCY_ADMIN: [
    "agency:manage_own",
    "join_request:review",
    "dashboard:view",
  ],
  AGENCY_USER: ["dashboard:view"],
};

export function roleHasPermission(
  role: UserRole,
  permission: Permission,
): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export interface AuthorizableUser {
  role: UserRole;
  status: UserStatus;
  agencyId: string | null;
}

/** Active users only. PENDING/SUSPENDED users cannot use protected features. */
function isActiveUser(user: AuthorizableUser): boolean {
  return user.status === "ACTIVE";
}

export function can(user: AuthorizableUser, permission: Permission): boolean {
  return isActiveUser(user) && roleHasPermission(user.role, permission);
}

export class ForbiddenError extends Error {
  constructor(message = "You do not have permission to perform this action") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export function assertPermission(
  user: AuthorizableUser,
  permission: Permission,
): void {
  if (!can(user, permission)) {
    throw new ForbiddenError();
  }
}

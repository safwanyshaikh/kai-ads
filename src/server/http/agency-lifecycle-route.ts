import { NextResponse, type NextRequest } from "next/server";
import type { ZodType } from "zod";
import { handleApiError } from "@/lib/errors";
import { requireCurrentUser } from "@/lib/session";
import { assertPermission, type Permission } from "@/lib/rbac";

type LifecycleInput = { agencyId: string; reason?: string };

/**
 * Factory for the four near-identical agency lifecycle endpoints
 * (approve / reject / suspend / activate). Each route file becomes a
 * one-line call — the actual behavior (permission, schema, service
 * method) is supplied per-endpoint, avoiding four copies of the same
 * request-parsing/error-handling boilerplate.
 */
export function createAgencyLifecycleRoute(config: {
  permission: Permission;
  schema: ZodType<LifecycleInput>;
  action: (agencyId: string, actorId: string, reason?: string) => Promise<unknown>;
}) {
  return async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
  ) {
    try {
      const user = await requireCurrentUser();
      assertPermission(user, config.permission);

      const { id } = await params;
      const body = await request.json().catch(() => ({}));
      const input = config.schema.parse({ agencyId: id, ...body });

      const agency = await config.action(input.agencyId, user.id, input.reason);

      return NextResponse.json({ data: agency });
    } catch (error) {
      return handleApiError(error);
    }
  };
}

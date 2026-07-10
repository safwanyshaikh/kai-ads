import { NextResponse } from "next/server";
import { agencyService } from "@/server/services/agency.service";
import { joinRequestService } from "@/server/services/join-request.service";
import { handleApiError, AppError } from "@/lib/errors";
import { requireCurrentUser } from "@/lib/session";
import { can } from "@/lib/rbac";

/**
 * GET /api/employees — lists employees + pending join requests for the
 * CALLER'S OWN agency only. Multi-tenant isolation is enforced here by
 * always deriving agencyId from the session, never from a query param.
 */
export async function GET() {
  try {
    const user = await requireCurrentUser();
    if (!user.agencyId) {
      throw new AppError("You are not associated with an agency.", 400);
    }

    const [employees, pendingJoinRequests] = await Promise.all([
      agencyService.listEmployees(user.agencyId),
      can(user, "join_request:review")
        ? joinRequestService.listForAgency(user.agencyId)
        : Promise.resolve([]),
    ]);

    return NextResponse.json({
      data: {
        employees: employees.map((e) => ({
          id: e.id,
          name: e.name,
          email: e.email,
          role: e.role,
          status: e.status,
        })),
        pendingJoinRequests,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

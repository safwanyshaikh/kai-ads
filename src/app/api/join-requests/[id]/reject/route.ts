import { NextResponse, type NextRequest } from "next/server";
import { reviewJoinRequestSchema } from "@/lib/validations/join-request";
import { joinRequestService } from "@/server/services/join-request.service";
import { joinRequestRepository } from "@/server/repositories/join-request.repository";
import { handleApiError, NotFoundError } from "@/lib/errors";
import { requireCurrentUser } from "@/lib/session";
import { assertPermission, ForbiddenError } from "@/lib/rbac";

/** POST /api/join-requests/[id]/reject — Agency Admin only, own agency. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireCurrentUser();
    assertPermission(user, "join_request:review");

    const { id } = await params;
    reviewJoinRequestSchema.parse({ joinRequestId: id });

    const existing = await joinRequestRepository.findById(id);
    if (!existing) throw new NotFoundError("Join request");
    if (existing.agencyId !== user.agencyId) {
      throw new ForbiddenError("You can only review join requests for your own agency.");
    }

    const updated = await joinRequestService.reject(id, user.id);

    return NextResponse.json({ data: { id: updated.id, status: updated.status } });
  } catch (error) {
    return handleApiError(error);
  }
}

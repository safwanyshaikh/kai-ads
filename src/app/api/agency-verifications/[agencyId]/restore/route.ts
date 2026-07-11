import { NextResponse, type NextRequest } from "next/server";
import { agencyVerificationService } from "@/server/services/agency-verification.service";
import { handleApiError } from "@/lib/errors";
import { requireCurrentUser } from "@/lib/session";
import { assertPermission } from "@/lib/rbac";

/** POST /api/agency-verifications/[agencyId]/restore — KAI Super Admin only. */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ agencyId: string }> },
) {
  try {
    const user = await requireCurrentUser();
    assertPermission(user, "agency:verify");
    const { agencyId } = await params;
    const verification = await agencyVerificationService.restore(agencyId, user.id);
    return NextResponse.json({ data: verification });
  } catch (error) {
    return handleApiError(error);
  }
}

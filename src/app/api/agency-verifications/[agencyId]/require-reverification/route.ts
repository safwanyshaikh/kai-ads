import { NextResponse, type NextRequest } from "next/server";
import { agencyVerificationStatusChangeSchema } from "@/lib/validations/agency-verification";
import { agencyVerificationService } from "@/server/services/agency-verification.service";
import { handleApiError } from "@/lib/errors";
import { requireCurrentUser } from "@/lib/session";
import { assertPermission } from "@/lib/rbac";

/** POST /api/agency-verifications/[agencyId]/require-reverification — KAI Super Admin only. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ agencyId: string }> },
) {
  try {
    const user = await requireCurrentUser();
    assertPermission(user, "agency:verify");
    const { agencyId } = await params;
    const body = await request.json().catch(() => ({}));
    const input = agencyVerificationStatusChangeSchema.parse(body);

    const verification = await agencyVerificationService.setStatus(
      agencyId,
      user.id,
      "REVERIFICATION_REQUIRED",
      input.notes,
    );
    return NextResponse.json({ data: verification });
  } catch (error) {
    return handleApiError(error);
  }
}

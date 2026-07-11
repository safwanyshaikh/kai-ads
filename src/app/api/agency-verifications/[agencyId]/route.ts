import { NextResponse, type NextRequest } from "next/server";
import { verifyAgencySchema } from "@/lib/validations/agency-verification";
import { agencyVerificationService } from "@/server/services/agency-verification.service";
import { handleApiError } from "@/lib/errors";
import { requireCurrentUser } from "@/lib/session";
import { assertPermission } from "@/lib/rbac";

/** GET /api/agency-verifications/[agencyId] */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ agencyId: string }> },
) {
  try {
    const user = await requireCurrentUser();
    assertPermission(user, "agency:verify");
    const { agencyId } = await params;
    const status = await agencyVerificationService.getStatus(agencyId);
    return NextResponse.json({ data: status });
  } catch (error) {
    return handleApiError(error);
  }
}

/** POST /api/agency-verifications/[agencyId] — verify (or re-verify) an agency. KAI Super Admin only. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ agencyId: string }> },
) {
  try {
    const user = await requireCurrentUser();
    assertPermission(user, "agency:verify");
    const { agencyId } = await params;
    const body = await request.json();
    const input = verifyAgencySchema.parse(body);

    const verification = await agencyVerificationService.verify(agencyId, user.id, input);
    return NextResponse.json({ data: verification });
  } catch (error) {
    return handleApiError(error);
  }
}

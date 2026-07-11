import { NextResponse } from "next/server";
import { agencyVerificationService } from "@/server/services/agency-verification.service";
import { handleApiError } from "@/lib/errors";
import { requireCurrentUser } from "@/lib/session";
import { assertPermission } from "@/lib/rbac";

/** GET /api/agency-verifications — every agency's verification status. KAI Super Admin only. */
export async function GET() {
  try {
    const user = await requireCurrentUser();
    assertPermission(user, "agency:verify");
    const verifications = await agencyVerificationService.listAll();
    return NextResponse.json({ data: verifications });
  } catch (error) {
    return handleApiError(error);
  }
}

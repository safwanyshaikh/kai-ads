import { NextResponse, type NextRequest } from "next/server";
import { grantGenerationQuotaSchema } from "@/lib/validations/agency";
import { generationQuotaService } from "@/server/services/generation-quota.service";
import { handleApiError } from "@/lib/errors";
import { requireCurrentUser } from "@/lib/session";
import { assertPermission } from "@/lib/rbac";

/**
 * POST /api/agencies/[id]/quota — KAI Super Admin only. Adds to (never
 * replaces) an agency's total generation quota — e.g. extending a
 * pilot/testing agency past the bootstrap trial limit. Always additive
 * and always audited; see generationQuotaService.grantAdditionalQuota.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireCurrentUser();
    assertPermission(user, "agency:manage_quota");

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const input = grantGenerationQuotaSchema.parse({ agencyId: id, ...body });

    const result = await generationQuotaService.grantAdditionalQuota(
      input.agencyId,
      input.amount,
      user.id,
      input.reason,
    );

    return NextResponse.json({ data: result });
  } catch (error) {
    return handleApiError(error);
  }
}

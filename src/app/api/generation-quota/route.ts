import { NextResponse } from "next/server";
import { generationQuotaService } from "@/server/services/generation-quota.service";
import { handleApiError } from "@/lib/errors";
import { requireAgencyMember } from "@/lib/session";

/** GET /api/generation-quota — the caller's own agency's shared quota status. */
export async function GET() {
  try {
    const user = await requireAgencyMember("advertisement:view");
    const status = await generationQuotaService.getStatus(user.agencyId);
    return NextResponse.json({ data: status });
  } catch (error) {
    return handleApiError(error);
  }
}

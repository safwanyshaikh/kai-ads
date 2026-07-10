import { NextResponse, type NextRequest } from "next/server";
import { advertisementService } from "@/server/services/advertisement.service";
import { handleApiError } from "@/lib/errors";
import { requireAgencyMember } from "@/lib/session";

/** GET /api/advertisements/[id]/versions — full version history. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAgencyMember("advertisement:view");
    const { id } = await params;
    const versions = await advertisementService.listVersions(id, user.agencyId);
    return NextResponse.json({ data: versions });
  } catch (error) {
    return handleApiError(error);
  }
}

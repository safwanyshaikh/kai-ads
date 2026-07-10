import { NextResponse, type NextRequest } from "next/server";
import { advertisementService } from "@/server/services/advertisement.service";
import { handleApiError } from "@/lib/errors";
import { requireAgencyMember } from "@/lib/session";

/** POST /api/advertisements/[id]/delete — soft delete (trash), not a hard DELETE. */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAgencyMember("advertisement:delete");
    const { id } = await params;
    const advertisement = await advertisementService.softDelete(id, user.agencyId, user.id);
    return NextResponse.json({ data: advertisement });
  } catch (error) {
    return handleApiError(error);
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { advertisementService } from "@/server/services/advertisement.service";
import { handleApiError } from "@/lib/errors";
import { requireAgencyMember } from "@/lib/session";

/** POST /api/advertisements/[id]/restore — un-archives OR undeletes, whichever applies. */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAgencyMember("advertisement:archive");
    const { id } = await params;
    const advertisement = await advertisementService.restore(id, user.agencyId, user.id);
    return NextResponse.json({ data: advertisement });
  } catch (error) {
    return handleApiError(error);
  }
}

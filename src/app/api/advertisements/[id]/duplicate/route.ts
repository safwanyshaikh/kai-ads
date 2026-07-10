import { NextResponse, type NextRequest } from "next/server";
import { advertisementService } from "@/server/services/advertisement.service";
import { handleApiError } from "@/lib/errors";
import { requireAgencyMember } from "@/lib/session";

/** POST /api/advertisements/[id]/duplicate */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAgencyMember("advertisement:duplicate");
    const { id } = await params;
    const duplicated = await advertisementService.duplicate(id, user.agencyId, user.id);
    return NextResponse.json({ data: duplicated }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

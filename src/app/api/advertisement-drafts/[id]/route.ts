import { NextResponse, type NextRequest } from "next/server";
import { advertisementDraftService } from "@/server/services/advertisement-draft.service";
import { handleApiError } from "@/lib/errors";
import { requireAgencyMember } from "@/lib/session";

/** GET /api/advertisement-drafts/[id] */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAgencyMember("advertisement:view");
    const { id } = await params;
    const draft = await advertisementDraftService.getById(id, user.agencyId);
    return NextResponse.json({ data: draft });
  } catch (error) {
    return handleApiError(error);
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { advertisementDraftService } from "@/server/services/advertisement-draft.service";
import { handleApiError } from "@/lib/errors";
import { requireAgencyMember } from "@/lib/session";

/** POST /api/advertisement-drafts/[id]/save — Preview -> Save. Converts the draft into a real Advertisement. */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAgencyMember("advertisement:create");
    const { id } = await params;
    const advertisement = await advertisementDraftService.save(id, user.agencyId, user.id);
    return NextResponse.json({ data: advertisement }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { selectDraftStyleSchema } from "@/lib/validations/advertisement-draft";
import { advertisementDraftService } from "@/server/services/advertisement-draft.service";
import { handleApiError } from "@/lib/errors";
import { requireAgencyMember } from "@/lib/session";

/** POST /api/advertisement-drafts/[id]/style — Style Selection (store only). */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAgencyMember("advertisement:create");
    const { id } = await params;
    const body = await request.json();
    const input = selectDraftStyleSchema.parse(body);
    const draft = await advertisementDraftService.selectStyle(id, user.agencyId, user.id, input.style);
    return NextResponse.json({ data: draft });
  } catch (error) {
    return handleApiError(error);
  }
}

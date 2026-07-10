import { NextResponse, type NextRequest } from "next/server";
import { reviewDraftSchema } from "@/lib/validations/advertisement-draft";
import { advertisementDraftService } from "@/server/services/advertisement-draft.service";
import { handleApiError } from "@/lib/errors";
import { requireAgencyMember } from "@/lib/session";

/** POST /api/advertisement-drafts/[id]/review — save the recruiter's edited/approved fields. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAgencyMember("advertisement:create");
    const { id } = await params;
    const body = await request.json();
    const input = reviewDraftSchema.parse(body);
    const draft = await advertisementDraftService.review(id, user.agencyId, user.id, input.reviewedData);
    return NextResponse.json({ data: draft });
  } catch (error) {
    return handleApiError(error);
  }
}

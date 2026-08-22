import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { advertisementDraftService } from "@/server/services/advertisement-draft.service";
import { handleApiError } from "@/lib/errors";
import { requireAgencyMember } from "@/lib/session";

/**
 * The tenant's choice of what to produce from the approved content.
 *
 * DTP and Social are separate rendering engines; Black & White and
 * Colour are two modes of DTP. One flat enum rather than a pair of
 * flags, so "Social in Black & White" is not expressible.
 */
const selectOutputSchema = z.object({
  outputType: z.enum(["DTP_BW", "DTP_COLOUR", "SOCIAL"]),
});

/**
 * POST /api/advertisement-drafts/[id]/output — choose the output format.
 *
 * Rejects with 409 until the content has been approved and any
 * source conflicts resolved: the workflow is content-first, and this is
 * where that is enforced.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAgencyMember("advertisement:edit");
    const { id } = await params;
    const { outputType } = selectOutputSchema.parse(await request.json());

    const draft = await advertisementDraftService.selectOutput(
      id, user.agencyId, user.id, outputType,
    );
    return NextResponse.json({ data: draft });
  } catch (error) {
    return handleApiError(error);
  }
}

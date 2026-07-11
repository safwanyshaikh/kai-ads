import { NextResponse, type NextRequest } from "next/server";
import { regenerateSectionSchema } from "@/lib/validations/advertisement-generation";
import { advertisementGenerationService } from "@/server/services/advertisement-generation.service";
import { handleApiError } from "@/lib/errors";
import { requireAgencyMember } from "@/lib/session";

/** POST /api/advertisements/[id]/section — regenerate/edit exactly one section. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAgencyMember("advertisement:edit");
    const { id } = await params;
    const body = await request.json();
    const input = regenerateSectionSchema.parse(body);

    const advertisement = await advertisementGenerationService.regenerateSection(
      id,
      user.agencyId,
      user.id,
      input.section,
      input.data,
      input.method,
      input.reason,
    );
    return NextResponse.json({ data: advertisement });
  } catch (error) {
    return handleApiError(error);
  }
}

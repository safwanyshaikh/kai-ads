import { NextResponse, type NextRequest } from "next/server";
import { advertisementStatusTransitionSchema } from "@/lib/validations/advertisement";
import { advertisementService } from "@/server/services/advertisement.service";
import { handleApiError } from "@/lib/errors";
import { requireAgencyMember } from "@/lib/session";

/** POST /api/advertisements/[id]/status — generic status transition (Draft/Review/Approved/Archived). */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAgencyMember("advertisement:edit");
    const { id } = await params;

    const body = await request.json();
    const input = advertisementStatusTransitionSchema.parse(body);

    const advertisement = await advertisementService.changeStatus(
      id,
      user.agencyId,
      user.id,
      input.toStatus,
      input.reason,
    );
    return NextResponse.json({ data: advertisement });
  } catch (error) {
    return handleApiError(error);
  }
}

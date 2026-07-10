import { NextResponse, type NextRequest } from "next/server";
import { updateAdvertisementSchema } from "@/lib/validations/advertisement";
import { advertisementService } from "@/server/services/advertisement.service";
import { handleApiError } from "@/lib/errors";
import { requireAgencyMember } from "@/lib/session";

/** GET /api/advertisements/[id] */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAgencyMember("advertisement:view");
    const { id } = await params;
    const advertisement = await advertisementService.getById(id, user.agencyId);
    return NextResponse.json({ data: advertisement });
  } catch (error) {
    return handleApiError(error);
  }
}

/** PATCH /api/advertisements/[id] — every update creates a new version. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAgencyMember("advertisement:edit");
    const { id } = await params;

    const body = await request.json();
    const input = updateAdvertisementSchema.parse(body);

    const advertisement = await advertisementService.update(id, user.agencyId, user.id, input);
    return NextResponse.json({ data: advertisement });
  } catch (error) {
    return handleApiError(error);
  }
}

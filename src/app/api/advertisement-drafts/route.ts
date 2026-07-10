import { NextResponse, type NextRequest } from "next/server";
import { createDraftSchema } from "@/lib/validations/advertisement-draft";
import { advertisementDraftService } from "@/server/services/advertisement-draft.service";
import { handleApiError } from "@/lib/errors";
import { requireAgencyMember } from "@/lib/session";
import { parsePagination } from "@/lib/pagination";
import { enforceRateLimit } from "@/server/rate-limit";
import { RATE_LIMITS } from "@/lib/constants";

/** POST /api/advertisement-drafts — Create Advertisement: choose an input method. */
export async function POST(request: NextRequest) {
  try {
    await enforceRateLimit(request, "advertisement-drafts:create", RATE_LIMITS.advertisementDraftCreate);
    const user = await requireAgencyMember("advertisement:create");

    const body = await request.json();
    const input = createDraftSchema.parse(body);

    const draft = await advertisementDraftService.create(user.agencyId, user.id, input);
    return NextResponse.json({ data: draft }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

/** GET /api/advertisement-drafts — paginated, for an in-progress-drafts view. */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAgencyMember("advertisement:view");
    const pagination = parsePagination(request.nextUrl.searchParams);
    const result = await advertisementDraftService.list(user.agencyId, pagination);
    return NextResponse.json({ data: result.data, pagination: result });
  } catch (error) {
    return handleApiError(error);
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { createAdvertisementSchema, advertisementSearchQuerySchema } from "@/lib/validations/advertisement";
import { advertisementService } from "@/server/services/advertisement.service";
import { handleApiError } from "@/lib/errors";
import { requireAgencyMember } from "@/lib/session";
import { parsePagination } from "@/lib/pagination";
import { enforceRateLimit } from "@/server/rate-limit";
import { RATE_LIMITS } from "@/lib/constants";

/** POST /api/advertisements — manual creation. Rate limited per IP in addition to auth. */
export async function POST(request: NextRequest) {
  try {
    await enforceRateLimit(request, "advertisements:create", RATE_LIMITS.advertisementCreate);
    const user = await requireAgencyMember("advertisement:create");

    const body = await request.json();
    const input = createAdvertisementSchema.parse(body);

    const advertisement = await advertisementService.create(user.agencyId, user.id, input);

    return NextResponse.json({ data: advertisement }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * GET /api/advertisements — Advertisement Library: search + filters + pagination.
 * ?q=&status=&style=&industry=&country=&createdById=&includeDeleted=&includeArchived=
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAgencyMember("advertisement:view");

    const searchParams = request.nextUrl.searchParams;
    const query = advertisementSearchQuerySchema.parse({
      q: searchParams.get("q") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      style: searchParams.get("style") ?? undefined,
      industry: searchParams.get("industry") ?? undefined,
      country: searchParams.get("country") ?? undefined,
      createdById: searchParams.get("createdById") ?? undefined,
      includeDeleted: searchParams.get("includeDeleted") ?? undefined,
      includeArchived: searchParams.get("includeArchived") ?? undefined,
    });
    const pagination = parsePagination(searchParams);

    const result = await advertisementService.list(
      { agencyId: user.agencyId, ...query },
      pagination,
    );

    return NextResponse.json({ data: result.data, pagination: result });
  } catch (error) {
    return handleApiError(error);
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { registerAgencySchema } from "@/lib/validations/agency";
import { agencyService } from "@/server/services/agency.service";
import { handleApiError } from "@/lib/errors";
import { requireCurrentUser } from "@/lib/session";
import { assertPermission } from "@/lib/rbac";
import { enforceRateLimit } from "@/server/rate-limit";
import { RATE_LIMITS } from "@/lib/constants";
import { parsePagination } from "@/lib/pagination";
import { createLogger } from "@/lib/logger";

const log = createLogger("api:agencies");

/** POST /api/agencies — public agency registration (Screen 2). Rate limited per IP. */
export async function POST(request: NextRequest) {
  try {
    await enforceRateLimit(request, "agencies:register", RATE_LIMITS.agencyRegistration);

    const body = await request.json();
    const input = registerAgencySchema.parse(body);

    const agency = await agencyService.register(input);

    return NextResponse.json(
      {
        data: {
          id: agency.id,
          name: agency.name,
          status: agency.status,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    log.error({ err: error }, "Agency registration failed");
    return handleApiError(error);
  }
}

/** GET /api/agencies — KAI Super Admin only. Paginated (?page=&pageSize=, default 25). */
export async function GET(request: NextRequest) {
  try {
    const user = await requireCurrentUser();
    assertPermission(user, "agency:view_all");

    const pagination = parsePagination(request.nextUrl.searchParams);
    const result = await agencyService.listAllPaginated(pagination);

    return NextResponse.json({ data: result.data, pagination: result });
  } catch (error) {
    return handleApiError(error);
  }
}

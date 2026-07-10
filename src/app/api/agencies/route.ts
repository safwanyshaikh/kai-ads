import { NextResponse, type NextRequest } from "next/server";
import { registerAgencySchema } from "@/lib/validations/agency";
import { agencyService } from "@/server/services/agency.service";
import { handleApiError } from "@/lib/errors";
import { requireCurrentUser } from "@/lib/session";
import { assertPermission } from "@/lib/rbac";
import { createLogger } from "@/lib/logger";

const log = createLogger("api:agencies");

/** POST /api/agencies — public agency registration (Screen 2). */
export async function POST(request: NextRequest) {
  try {
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

/** GET /api/agencies — KAI Super Admin only. Supports ?status=PENDING */
export async function GET(request: NextRequest) {
  try {
    const user = await requireCurrentUser();
    assertPermission(user, "agency:view_all");

    const status = request.nextUrl.searchParams.get("status");
    const agencies =
      status === "PENDING"
        ? await agencyService.listPending()
        : await agencyService.listAll({});

    return NextResponse.json({ data: agencies });
  } catch (error) {
    return handleApiError(error);
  }
}

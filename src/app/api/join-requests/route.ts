import { NextResponse, type NextRequest } from "next/server";
import { createJoinRequestSchema } from "@/lib/validations/join-request";
import { joinRequestService } from "@/server/services/join-request.service";
import { handleApiError } from "@/lib/errors";
import { enforceRateLimit } from "@/server/rate-limit";
import { RATE_LIMITS } from "@/lib/constants";

/** POST /api/join-requests — public. Employee requests to join their agency. Rate limited per IP. */
export async function POST(request: NextRequest) {
  try {
    await enforceRateLimit(request, "join-requests:create", RATE_LIMITS.joinRequest);

    const body = await request.json();
    const input = createJoinRequestSchema.parse(body);

    const { joinRequest, agency } = await joinRequestService.create(input);

    return NextResponse.json(
      {
        data: {
          id: joinRequest.id,
          status: joinRequest.status,
          agencyName: agency.name,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}

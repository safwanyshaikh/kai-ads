import { NextResponse, type NextRequest } from "next/server";
import { createJoinRequestSchema } from "@/lib/validations/join-request";
import { joinRequestService } from "@/server/services/join-request.service";
import { handleApiError } from "@/lib/errors";

/** POST /api/join-requests — public. Employee requests to join their agency. */
export async function POST(request: NextRequest) {
  try {
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

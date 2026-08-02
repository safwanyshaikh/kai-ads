import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/session";
import { assertPermission } from "@/lib/rbac";
import { handleApiError } from "@/lib/errors";
import { fatValidationService } from "@/server/services/fat-validation.service";

/** GET /api/internal/fat/runs — run history: timestamp, input type, status. */
export async function GET() {
  try {
    const user = await requireCurrentUser();
    assertPermission(user, "fat:access");

    const runs = await fatValidationService.listRuns();
    return NextResponse.json({ data: runs });
  } catch (error) {
    return handleApiError(error);
  }
}

import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/session";
import { assertPermission } from "@/lib/rbac";
import { handleApiError } from "@/lib/errors";
import { computeFatHealth } from "@/server/fat-health";

/**
 * GET /api/internal/fat/health — Task 006.5 requirement 6.
 *
 * Green/red per subsystem, for the Founder validation page's own widget.
 * The human-readable page at /internal/fat/health uses the same
 * computeFatHealth() so the two can never disagree.
 */
export async function GET() {
  try {
    const user = await requireCurrentUser();
    assertPermission(user, "fat:access");

    const health = await computeFatHealth();
    return NextResponse.json({ data: health });
  } catch (error) {
    return handleApiError(error);
  }
}

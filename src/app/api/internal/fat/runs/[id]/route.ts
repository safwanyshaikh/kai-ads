import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/session";
import { assertPermission } from "@/lib/rbac";
import { handleApiError, NotFoundError } from "@/lib/errors";
import { ensureSandboxAgency, fatValidationService } from "@/server/services/fat-validation.service";

/** GET /api/internal/fat/runs/[id] — "View Result": the full snapshot for one past run. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCurrentUser();
    assertPermission(user, "fat:access");

    const { id } = await params;
    const agencyId = await ensureSandboxAgency();

    const snapshot = await fatValidationService.getSnapshot(id, agencyId);
    if (!snapshot) throw new NotFoundError("FAT run");

    return NextResponse.json({ data: snapshot });
  } catch (error) {
    return handleApiError(error);
  }
}

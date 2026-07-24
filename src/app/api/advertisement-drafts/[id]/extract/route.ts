import { NextResponse, type NextRequest } from "next/server";
import { advertisementDraftService } from "@/server/services/advertisement-draft.service";
import { handleApiError } from "@/lib/errors";
import { requireAgencyMember } from "@/lib/session";

/** Sprint 008 Workstream A: extraction calls the text/vision model (can run 30-90s on long requirements) — needs more than the platform's default duration, less than a full generation. */
export const maxDuration = 120;

/**
 * POST /api/advertisement-drafts/[id]/extract — AI Extraction Review step.
 * Architecture only in Sprint 002: every provider is unimplemented, so
 * this always resolves the draft to EXTRACTION_FAILED with a clear
 * `extractionError` message rather than throwing an unhandled 500 — the
 * review screen is built to fall back to manual entry on that status.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAgencyMember("advertisement:create");
    const { id } = await params;
    const draft = await advertisementDraftService.runExtraction(id, user.agencyId, user.id);
    return NextResponse.json({ data: draft });
  } catch (error) {
    return handleApiError(error);
  }
}

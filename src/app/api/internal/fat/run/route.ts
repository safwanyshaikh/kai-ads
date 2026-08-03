import { NextResponse, type NextRequest } from "next/server";
import { requireFounder } from "@/server/fat/guard";
import { runFounderPipeline } from "@/server/fat/pipeline";
import { fatRunSchema } from "@/lib/validations/fat";
import { handleApiError } from "@/lib/errors";

/**
 * Task 006.5 — POST /api/internal/fat/run — the RUN PIPELINE button.
 * Founder-only (requireFounder, independent of the Task 001 RBAC matrix).
 * Extraction can take as long as the existing extract route allows.
 */
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    const user = await requireFounder();
    const body = await request.json();
    const input = fatRunSchema.parse(body);

    const result = await runFounderPipeline(input, user.id, user.email);
    return NextResponse.json({ data: result });
  } catch (error) {
    return handleApiError(error);
  }
}

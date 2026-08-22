import { NextResponse, type NextRequest } from "next/server";
import { requireFounder } from "@/server/fat/guard";
import { advertisementGenerationService } from "@/server/services/advertisement-generation.service";
import { getOrCreateFatSandboxAgency } from "@/server/fat/sandbox-agency";
import { fatGenerateSchema } from "@/lib/validations/fat";
import { handleApiError } from "@/lib/errors";

/**
 * Task 006.5 — POST /api/internal/fat/generate — opt-in, separate from
 * RUN PIPELINE. Calls the exact same advertisementGenerationService.generate
 * used by Task 004's production /api/advertisements/[id]/generate route
 * (same maxDuration, same quota accounting, same image-provider call), so
 * this is the only way to see the real Layout Intelligence footer/branding
 * decision and the real rendered artwork. Kept out of the default RUN
 * PIPELINE because it consumes one of the sandbox agency's generation
 * credits and calls a paid image model.
 */
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const user = await requireFounder();
    const body = await request.json();
    const input = fatGenerateSchema.parse(body);
    const agency = await getOrCreateFatSandboxAgency();

    const advertisement = await advertisementGenerationService.generate(
      input.advertisementId,
      agency.id,
      user.id,
      { outputFormat: "SOCIAL", platformFormat: input.platformFormat },
    );
    return NextResponse.json({ data: advertisement });
  } catch (error) {
    return handleApiError(error);
  }
}

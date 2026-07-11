import { NextResponse, type NextRequest } from "next/server";
import { generateAdvertisementSchema } from "@/lib/validations/advertisement-generation";
import { advertisementGenerationService } from "@/server/services/advertisement-generation.service";
import { handleApiError } from "@/lib/errors";
import { requireAgencyMember } from "@/lib/session";
import { enforceRateLimit } from "@/server/rate-limit";

/**
 * POST /api/advertisements/[id]/generate — Select Platform -> KAI
 * Recommends Type -> Generate -> Trust Validation -> QR Decode
 * Validation -> Save Version, all in one call (see
 * advertisementGenerationService.generate for the full flow).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAgencyMember("advertisement:generate");
    await enforceRateLimit(request, "advertisements:generate", { limit: 30, windowSeconds: 60 * 60 });

    const { id } = await params;
    const body = await request.json();
    const input = generateAdvertisementSchema.parse(body);

    const advertisement = await advertisementGenerationService.generate(id, user.agencyId, user.id, input);
    return NextResponse.json({ data: advertisement });
  } catch (error) {
    return handleApiError(error);
  }
}

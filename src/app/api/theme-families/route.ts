import { NextResponse, type NextRequest } from "next/server";
import { listThemeFamilies, recommendThemes } from "@/server/generation/theme-recommendation.service";
import { classifyDensity } from "@/server/generation/density-classification.service";
import { handleApiError, AppError } from "@/lib/errors";
import { requireAgencyMember } from "@/lib/session";
import { agencyRepository } from "@/server/repositories/agency.repository";
import type { AdvertisementStyle } from "@prisma/client";

/**
 * GET /api/theme-families?style=&positionsCount= — theme families, or a
 * recommended shortlist when a style is given (see Theme Intelligence).
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAgencyMember("advertisement:view");
    const style = request.nextUrl.searchParams.get("style") as AdvertisementStyle | null;

    if (!style) {
      return NextResponse.json({ data: listThemeFamilies() });
    }

    if (!["VISUAL", "TYPOGRAPHY", "NEWSPAPER"].includes(style)) {
      throw new AppError("Invalid style.", 400);
    }

    const agency = await agencyRepository.findById(user.agencyId);
    const themes = recommendThemes({
      style,
      density: classifyDensity([]),
      hasLogo: Boolean(agency?.logoUrl),
    });

    return NextResponse.json({ data: themes });
  } catch (error) {
    return handleApiError(error);
  }
}

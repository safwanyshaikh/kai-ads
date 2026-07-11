import { NextResponse } from "next/server";
import { listPlatformFormats } from "@/lib/platform-formats";
import { handleApiError } from "@/lib/errors";
import { requireAgencyMember } from "@/lib/session";

/** GET /api/platform-formats — the centralized format registry, for the format picker UI. */
export async function GET() {
  try {
    await requireAgencyMember("advertisement:view");
    return NextResponse.json({ data: listPlatformFormats() });
  } catch (error) {
    return handleApiError(error);
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { requireFounder } from "@/server/fat/guard";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/errors";

/**
 * Task 006.5 — GET /api/internal/fat/history — Run History. Reads the
 * fat_pipeline_runs table this feature added (see prisma/schema.prisma);
 * touches no Task 001-006 table.
 */
export async function GET(request: NextRequest) {
  try {
    await requireFounder();
    const limitParam = request.nextUrl.searchParams.get("limit");
    const limit = Math.min(Math.max(Number(limitParam) || 25, 1), 100);

    const runs = await db.fatPipelineRun.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        actorEmail: true,
        sourceType: true,
        sourceLabel: true,
        draftId: true,
        advertisementId: true,
        succeeded: true,
        errorMessage: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ data: runs });
  } catch (error) {
    return handleApiError(error);
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { requireFounder } from "@/server/fat/guard";
import { db } from "@/lib/db";
import { handleApiError, NotFoundError, AppError } from "@/lib/errors";

/**
 * Task 006.5 — GET /api/internal/fat/export/[runId]?scope=jobOrder|intelligence|complete
 *
 * A raw JSON dump of data this run already computed and stored on
 * fat_pipeline_runs.stages — no new shape, no new business logic, just a
 * different slice of the same object the RUN PIPELINE response and the
 * expandable cards already show.
 */
const SCOPES = ["jobOrder", "intelligence", "complete"] as const;
type Scope = (typeof SCOPES)[number];

export async function GET(request: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  try {
    await requireFounder();
    const { runId } = await params;
    const scopeParam = request.nextUrl.searchParams.get("scope") ?? "complete";
    if (!SCOPES.includes(scopeParam as Scope)) {
      throw new AppError(`scope must be one of: ${SCOPES.join(", ")}`, 400);
    }
    const scope = scopeParam as Scope;

    const run = await db.fatPipelineRun.findUnique({ where: { id: runId } });
    if (!run) throw new NotFoundError("FAT pipeline run");

    const stages = run.stages as Record<string, unknown>;
    let payload: unknown;
    let filename: string;

    if (scope === "jobOrder") {
      payload = (stages.jobOrder as { data?: unknown })?.data ?? null;
      filename = `fat-job-order-${run.id}.json`;
    } else if (scope === "intelligence") {
      const { jobOrder: _jobOrder, ...intelligence } = stages;
      payload = intelligence;
      filename = `fat-intelligence-${run.id}.json`;
    } else {
      payload = {
        runId: run.id,
        createdAt: run.createdAt,
        actorEmail: run.actorEmail,
        sourceType: run.sourceType,
        sourceLabel: run.sourceLabel,
        succeeded: run.succeeded,
        errorMessage: run.errorMessage,
        stages,
      };
      filename = `fat-complete-${run.id}.json`;
    }

    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

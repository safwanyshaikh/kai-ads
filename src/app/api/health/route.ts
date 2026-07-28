import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getIntegrationStatus } from "@/lib/env";

/**
 * GET /api/health — Sprint 008 Workstream H (Supreme Principle 15:
 * monitoring/production diagnostics). Public, unauthenticated liveness +
 * readiness probe for uptime monitors and deploy verification.
 *
 * Reports subsystem availability WITHOUT leaking configuration detail:
 * booleans only — never provider names beyond the integration flags the
 * app already exposes internally, never URLs, never key material.
 */
export async function GET() {
  let database = false;
  try {
    await db.$queryRaw`SELECT 1`;
    database = true;
  } catch {
    database = false;
  }

  const integrations = getIntegrationStatus();
  // Gemini migration: text and image are independently gated and either
  // vendor can serve them, so AI is available when any provider is
  // configured for a stage. Reporting only `openai` here made the probe
  // show AI down on a Gemini-only deployment — a false outage.
  const ai =
    integrations.geminiText || integrations.geminiImage || integrations.openai;
  const healthy = database;

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      database,
      ai,
      email: integrations.email,
      storage: integrations.storage,
      timestamp: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503 },
  );
}

import { db } from "@/lib/db";
import { getEnv, getIntegrationStatus } from "@/lib/env";
import { getAuth } from "@/lib/auth";

/**
 * Task 006.5 requirement 6 — one definition, used by both
 * /api/internal/fat/health (JSON, for the page's own widget) and
 * /internal/fat/health (server-rendered, green/red). Duplicating this
 * across both would let them silently disagree about what "healthy"
 * means.
 */
export interface FatHealthReport {
  database: boolean;
  aiProvider: boolean;
  storage: boolean;
  authentication: boolean;
  environment: boolean;
}

export async function computeFatHealth(): Promise<FatHealthReport> {
  let database = false;
  try {
    await db.$queryRaw`SELECT 1`;
    database = true;
  } catch {
    database = false;
  }

  let environment = false;
  try {
    getEnv();
    environment = true;
  } catch {
    environment = false;
  }

  let authentication = false;
  try {
    getAuth();
    authentication = true;
  } catch {
    authentication = false;
  }

  const integrations = getIntegrationStatus();

  return {
    database,
    aiProvider: integrations.geminiText || integrations.geminiImage || integrations.openai,
    storage: integrations.storage,
    authentication,
    environment,
  };
}

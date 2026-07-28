import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * /api/health is the deploy-verification and uptime probe. Its `ai` flag
 * reported only `integrations.openai`, so a Gemini-only deployment — which
 * is the production configuration — would have shown AI as down. That is a
 * false outage in monitoring, not a real one.
 *
 * Asserted against the route source because the handler needs a live
 * database connection to invoke.
 */
describe("Health endpoint AI availability", () => {
  const source = readFileSync("src/app/api/health/route.ts", "utf8");

  it("treats either Gemini gate as AI being available", () => {
    expect(source).toContain("integrations.geminiText");
    expect(source).toContain("integrations.geminiImage");
  });

  it("still counts OpenAI, which remains the fallback provider", () => {
    expect(source).toContain("integrations.openai");
  });

  it("does not report AI purely from the OpenAI flag", () => {
    expect(source).not.toMatch(/ai:\s*integrations\.openai\s*,/);
  });

  it("keeps readiness tied to the database", () => {
    expect(source).toMatch(/const healthy = database;/);
  });
});

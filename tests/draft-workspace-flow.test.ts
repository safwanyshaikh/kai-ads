import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * KAI is an assistant, not a data-entry form. When extraction fails the
 * recruiter must get a compact recovery panel — Retry / Continue Manually
 * — not the full 30-field editor dumped on them as the default experience.
 *
 * The manual editor is the fallback path and may only appear after the
 * recruiter explicitly chooses it.
 */
describe("Create Advertisement presentation flow", () => {
  const source = readFileSync("src/components/advertisement/draft-workspace.tsx", "utf8");

  it("has a recovery step between failed extraction and the manual editor", () => {
    expect(source).toMatch(/type Step =[^;]*"recovery"/);
  });

  it("routes extraction failures to recovery, never straight to the editor", () => {
    // Both hard-failure branches (request failed, unparseable payload).
    // Whitespace-tolerant: this codebase's own formatting puts a single
    // call argument on its own line (`setStep(\n  "recovery",\n)`), not
    // just the single-line `setStep("recovery")` form.
    const failureBranches = source.match(/setStep\(\s*"recovery"\s*,?\s*\)/g) ?? [];
    expect(failureBranches.length).toBeGreaterThanOrEqual(2);
  });

  it("offers both Retry and Continue Manually in recovery", () => {
    expect(source).toContain("Retry");
    expect(source).toContain("Continue Manually");
    expect(source).toContain("handleContinueManually");
  });

  it("only reaches the manual editor through an explicit choice or a partial result", () => {
    // handleContinueManually is the sole path that promotes recovery to
    // manual — whitespace-tolerant for the same multi-line call-argument
    // formatting as above.
    expect(source).toMatch(/function handleContinueManually\(\)[\s\S]*?setStep\(\s*"manual"\s*,?\s*\)/);
  });

  it("speaks to the recruiter rather than naming internal pipeline stages", () => {
    expect(source).not.toContain("Running AI Extraction");
    expect(source).toMatch(/KAI is reading your requirement/);
  });

  it("never names a provider in any user-visible string", () => {
    const strings = source.match(/"[^"]{4,}"/g) ?? [];
    for (const s of strings) {
      expect(s, s).not.toMatch(/openai|gemini|gpt-|anthropic/i);
    }
  });
});

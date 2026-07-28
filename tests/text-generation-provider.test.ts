import { describe, expect, it } from "vitest";
import { getTextGenerationProvider } from "@/server/ai/text";
import { TextProviderNotImplementedError } from "@/server/ai/text/text-provider.interface";
import { GeminiTextProvider } from "@/server/ai/text/gemini-text-provider";
import { OpenAiTextProvider } from "@/server/ai/text/openai-text-provider";

/**
 * The Creative Brief stage runs through this seam so it can be served by
 * Gemini or OpenAI without the brief knowing which. These tests pin the
 * contract the pipeline depends on: a provider always exists, and when
 * none is configured it fails loudly rather than returning a fabricated
 * brief (a silent empty brief would reach GPT Image and produce an
 * advertisement with no grounded facts at all).
 */
describe("Text generation provider seam", () => {
  it("always resolves a provider", () => {
    expect(getTextGenerationProvider()).toBeDefined();
  });

  it("falls back to the not-implemented stand-in when no key is configured", () => {
    // The test env sets neither GEMINI_TEXT_API_KEY nor OPENAI_API_KEY.
    expect(getTextGenerationProvider().name).toBe("not-implemented");
  });

  it("throws TextProviderNotImplementedError instead of returning a fake brief", async () => {
    await expect(
      getTextGenerationProvider().generateText({ instructions: "sys", input: "{}" }),
    ).rejects.toThrow(TextProviderNotImplementedError);
  });

  it("exposes both vendor implementations under stable provider names", () => {
    // Option A: the two vendors are independently selectable, so their
    // names must stay stable for logging/cost attribution.
    expect(new GeminiTextProvider().name).toBe("gemini");
    expect(new OpenAiTextProvider().name).toBe("openai");
  });
});

/**
 * Text generation provider interface — the seam that lets the Creative
 * Brief stage run on either OpenAI or Gemini without the brief itself
 * knowing which. Same pattern as the extraction providers (Sprint 002/003)
 * and the image provider (Sprint 004): an interface, a Null stand-in, and
 * one real implementation per vendor, selected by a factory that never
 * exposes provider/model names to agency users.
 *
 * This carries NO prompt content of its own. The Creative Brief's
 * instructions live in generation/pipeline/creative-brief.ts and are
 * passed through verbatim — this is transport, not a second prompt
 * builder (KAI Ads V2 Constitution: exactly one prompt builder).
 */

export interface TextGenerationInput {
  /** System-level instructions — the provider maps this to its own native field. */
  instructions: string;
  /** The user-role payload the model reasons over. */
  input: string;
  /**
   * Optional PNG the model must look at as well as read. Used by Vision QA
   * to transcribe a finished advertisement back off its own pixels. Sent as
   * native image input by each provider — never base64 pasted into `input`,
   * which exceeds the token limit on any real advertisement.
   */
  imagePng?: Buffer;
}

export interface TextGenerationUsage {
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number;
}

export interface TextGenerationProvider {
  readonly name: string;
  generateText(
    input: TextGenerationInput,
  ): Promise<{ text: string; usage: TextGenerationUsage }>;
}

export class TextProviderNotImplementedError extends Error {
  constructor() {
    super(
      "The KAI Intelligence Engine has no text implementation configured. Set GEMINI_TEXT_API_KEY or OPENAI_API_KEY to enable Creative Brief generation.",
    );
    this.name = "TextProviderNotImplementedError";
  }
}

/**
 * KAI Creative Engine — image generation provider interface (Sprint 004).
 * Same pattern as the Sprint 002/003 extraction providers: an interface,
 * a Null stand-in, and a real implementation, selected by a factory that
 * never exposes provider/model names to agency users.
 */

export interface ImageGenerationInput {
  /** Creative brief for the GPT image model — for Visual Hero, this requests a premium TEXT-FREE creative visual canvas. GPT generates imagery, atmosphere, and visual composition; KAI deterministically renders ALL factual typography on top. GPT must not render any readable text, numbers, logos, or factual copy. */
  prompt: string;
  widthPx: number;
  heightPx: number;
  quality: "low" | "medium" | "high";
}

export interface ImageGenerationOutput {
  imageBase64: string;
  mimeType: string;
}

export interface ImageGenerationUsage {
  model: string;
  latencyMs: number;
  estimatedCostUsd: number | null;
}

export interface ImageGenerationProvider {
  readonly name: string;
  generate(
    input: ImageGenerationInput,
  ): Promise<{ output: ImageGenerationOutput; usage: ImageGenerationUsage }>;
}

export class ImageProviderNotImplementedError extends Error {
  constructor() {
    super(
      "The KAI Creative Engine has no implementation configured. Set OPENAI_API_KEY to enable AI background generation for the Visual advertisement style.",
    );
    this.name = "ImageProviderNotImplementedError";
  }
}

import { ApiError } from "@google/genai";
import { getGeminiTextClient, getKaiTextModel } from "@/server/ai/gemini/gemini-client";
import {
  AiInvalidResponseError,
  AiNotConfiguredError,
  AiRateLimitError,
  AiTimeoutError,
} from "@/server/ai/openai/errors";
import type {
  TextGenerationInput,
  TextGenerationProvider,
  TextGenerationUsage,
} from "./text-provider.interface";

/**
 * Gemini text generation. Maps the vendor-neutral {instructions, input}
 * pair onto Gemini's native shape: `instructions` becomes
 * `config.systemInstruction`, `input` becomes `contents`. No response
 * schema is set — the Creative Brief is free prose, not structured JSON.
 *
 * Error mapping matches gemini/kai-extraction-engine.ts so callers see the
 * same AppError types regardless of which stage failed.
 */
export class GeminiTextProvider implements TextGenerationProvider {
  readonly name = "gemini";

  async generateText(
    input: TextGenerationInput,
  ): Promise<{ text: string; usage: TextGenerationUsage }> {
    const client = getGeminiTextClient();
    const model = getKaiTextModel();
    const startedAt = Date.now();

    try {
      const response = await client.models.generateContent({
        model,
        contents: input.imagePng
          ? [
              {
                role: "user",
                parts: [
                  { inlineData: { mimeType: "image/png", data: input.imagePng.toString("base64") } },
                  { text: input.input },
                ],
              },
            ]
          : input.input,
        config: { systemInstruction: input.instructions },
      });

      if (!response.text) {
        throw new AiInvalidResponseError("the model returned no text output");
      }

      return {
        text: response.text,
        usage: {
          model,
          inputTokens: response.usageMetadata?.promptTokenCount ?? null,
          outputTokens: response.usageMetadata?.candidatesTokenCount ?? null,
          latencyMs: Date.now() - startedAt,
        },
      };
    } catch (error) {
      if (error instanceof AiNotConfiguredError || error instanceof AiInvalidResponseError) {
        throw error;
      }
      if (error instanceof ApiError) {
        if (error.status === 429) throw new AiRateLimitError();
        if (error.status === 401 || error.status === 403) throw new AiNotConfiguredError();
        if (error.status === 504 || error.status === 408) throw new AiTimeoutError();
      }
      throw new AiInvalidResponseError(error instanceof Error ? error.message : undefined);
    }
  }
}

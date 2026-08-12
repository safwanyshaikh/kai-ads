import { getOpenAiClient, getKaiTextModel } from "@/server/ai/openai/openai-client";
import type {
  TextGenerationInput,
  TextGenerationProvider,
  TextGenerationUsage,
} from "./text-provider.interface";

/**
 * OpenAI text generation — the exact call the Creative Brief stage made
 * inline before the provider seam existed (client.responses.create with
 * `instructions` + `input`, reading `output_text`). Behaviour unchanged;
 * only its location moved.
 */
export class OpenAiTextProvider implements TextGenerationProvider {
  readonly name = "openai";

  async generateText(
    input: TextGenerationInput,
  ): Promise<{ text: string; usage: TextGenerationUsage }> {
    const client = getOpenAiClient();
    const model = getKaiTextModel();
    const startedAt = Date.now();

    const response = await client.responses.create({
      model,
      instructions: input.instructions,
      input: input.imagePng
        ? [
            {
              role: "user" as const,
              content: [
                { type: "input_text" as const, text: input.input },
                {
                  type: "input_image" as const,
                  image_url: `data:image/png;base64,${input.imagePng.toString("base64")}`,
                  detail: "high" as const,
                },
              ],
            },
          ]
        : input.input,
    });

    return {
      text: response.output_text,
      usage: {
        model,
        inputTokens: response.usage?.input_tokens ?? null,
        outputTokens: response.usage?.output_tokens ?? null,
        latencyMs: Date.now() - startedAt,
      },
    };
  }
}

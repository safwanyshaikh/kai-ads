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
      input: input.input,
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

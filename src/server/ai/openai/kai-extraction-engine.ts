import {
  RateLimitError as OpenAiRateLimitError,
  APIConnectionTimeoutError,
  AuthenticationError as OpenAiAuthenticationError,
} from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAiClient, getKaiTextModel, getKaiVisionModel } from "./openai-client";
import { buildKaiSystemPrompt, buildKaiVisionPromptAddendum } from "./prompts";
import {
  extractionResultSchema,
  emptyExtractionResult,
  type ExtractionResult,
} from "../extraction-result.schema";
import { AiInvalidResponseError, AiRateLimitError, AiTimeoutError, AiNotConfiguredError } from "./errors";
import { createLogger } from "@/lib/logger";

const log = createLogger("kai-extraction-engine");

/** "Do not send unnecessary content to the AI provider" — a hard cap regardless of caller-side limits. */
const MAX_INPUT_CHARS = 20000;

interface KaiExtractionInput {
  text?: string;
  imageBase64?: string;
  imageMimeType?: string;
}

export interface KaiExtractionOutcome {
  result: ExtractionResult;
  model: string;
  usage: {
    inputTokens: number | null;
    outputTokens: number | null;
    latencyMs: number;
  };
}

/**
 * The one real call to OpenAI behind the entire KAI Intelligence Engine.
 * Every provider in kai-extraction-provider.ts calls this exactly once
 * per unique input and slices its own field(s) out of the shared result
 * — extracting country, industry, positions, etc. as seven separate API
 * calls would violate "Do not send unnecessary content to the AI
 * provider" and multiply cost for zero benefit, since it's fundamentally
 * one extraction task.
 */
export async function runKaiExtraction(input: KaiExtractionInput): Promise<KaiExtractionOutcome> {
  const client = getOpenAiClient(); // throws AiNotConfiguredError if unset
  const startedAt = Date.now();

  try {
    if (input.imageBase64) {
      return await runVisionExtraction(client, input, startedAt);
    }
    if (input.text) {
      return await runTextExtraction(client, input.text, startedAt);
    }
    throw new AiInvalidResponseError("no text or image was provided to extract from");
  } catch (error) {
    if (error instanceof AiNotConfiguredError || error instanceof AiInvalidResponseError) {
      throw error;
    }
    if (error instanceof OpenAiRateLimitError) {
      throw new AiRateLimitError();
    }
    if (error instanceof APIConnectionTimeoutError) {
      throw new AiTimeoutError();
    }
    if (error instanceof OpenAiAuthenticationError) {
      throw new AiNotConfiguredError();
    }
    log.error({ err: error }, "KAI extraction failed with an unexpected error");
    throw new AiInvalidResponseError(error instanceof Error ? error.message : undefined);
  }
}

async function runTextExtraction(
  client: ReturnType<typeof getOpenAiClient>,
  text: string,
  startedAt: number,
): Promise<KaiExtractionOutcome> {
  const truncated = text.slice(0, MAX_INPUT_CHARS);

  const response = await client.responses.parse({
    model: getKaiTextModel(),
    instructions: buildKaiSystemPrompt(),
    input: truncated,
    text: { format: zodTextFormat(extractionResultSchema, "kai_extraction_result") },
  });

  return toOutcome(response, startedAt, truncated, getKaiTextModel());
}

async function runVisionExtraction(
  client: ReturnType<typeof getOpenAiClient>,
  input: KaiExtractionInput,
  startedAt: number,
): Promise<KaiExtractionOutcome> {
  const response = await client.responses.parse({
    model: getKaiVisionModel(),
    instructions: buildKaiSystemPrompt() + buildKaiVisionPromptAddendum(),
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: "Extract the recruitment requirement from this image." },
          {
            type: "input_image",
            image_url: `data:${input.imageMimeType ?? "image/png"};base64,${input.imageBase64}`,
            detail: "auto",
          },
        ],
      },
    ],
    text: { format: zodTextFormat(extractionResultSchema, "kai_extraction_result") },
  });

  return toOutcome(response, startedAt, "(image input)", getKaiVisionModel());
}

function toOutcome(
  response: { output_parsed: ExtractionResult | null; usage?: { input_tokens?: number; output_tokens?: number } },
  startedAt: number,
  fallbackSourceText: string,
  model: string,
): KaiExtractionOutcome {
  const latencyMs = Date.now() - startedAt;

  if (!response.output_parsed) {
    log.warn({ latencyMs }, "KAI extraction returned no parsed output — falling back to an empty result");
    return {
      result: emptyExtractionResult(fallbackSourceText),
      model,
      usage: {
        inputTokens: response.usage?.input_tokens ?? null,
        outputTokens: response.usage?.output_tokens ?? null,
        latencyMs,
      },
    };
  }

  return {
    result: response.output_parsed,
    model,
    usage: {
      inputTokens: response.usage?.input_tokens ?? null,
      outputTokens: response.usage?.output_tokens ?? null,
      latencyMs,
    },
  };
}

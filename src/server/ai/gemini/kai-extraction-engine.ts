import { z } from "zod";
import { ApiError } from "@google/genai";
import { getGeminiTextClient, getKaiTextModel, getKaiVisionModel } from "./gemini-client";
import { buildKaiSystemPrompt, buildKaiVisionPromptAddendum } from "../openai/prompts";
import {
  extractionResultSchema,
  emptyExtractionResult,
  type ExtractionResult,
} from "../extraction-result.schema";
import { enforceSourceGrounding } from "../openai/kai-extraction-engine";
import { AiInvalidResponseError, AiRateLimitError, AiTimeoutError, AiNotConfiguredError } from "../openai/errors";
import { createLogger } from "@/lib/logger";

const log = createLogger("kai-gemini-extraction-engine");

/** "Do not send unnecessary content to the AI provider" — same hard cap as the OpenAI engine. */
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
 * Gemini equivalent of openai/kai-extraction-engine.ts's runKaiExtraction —
 * same contract, same prompts (imported, not duplicated), same
 * source-grounding enforcement (imported, not duplicated). Only the
 * underlying API call differs: Gemini's structured-output contract is the
 * same `extractionResultSchema` used by the OpenAI path, converted to a
 * JSON Schema via Zod's native `z.toJSONSchema()` (the schema's own doc
 * comment already documents this as its intended, provider-agnostic use)
 * rather than OpenAI's `zodTextFormat` helper.
 */
export async function runKaiGeminiExtraction(input: KaiExtractionInput): Promise<KaiExtractionOutcome> {
  const client = getGeminiTextClient(); // throws AiNotConfiguredError if GEMINI_TEXT_API_KEY is unset
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
    if (error instanceof ApiError) {
      if (error.status === 429) throw new AiRateLimitError();
      if (error.status === 401 || error.status === 403) throw new AiNotConfiguredError();
      if (error.status === 504 || error.status === 408) throw new AiTimeoutError();
    }
    log.error({ err: error }, "Gemini KAI extraction failed with an unexpected error");
    throw new AiInvalidResponseError(error instanceof Error ? error.message : undefined);
  }
}

const responseJsonSchema = z.toJSONSchema(extractionResultSchema);

async function runTextExtraction(
  client: ReturnType<typeof getGeminiTextClient>,
  text: string,
  startedAt: number,
): Promise<KaiExtractionOutcome> {
  const truncated = text.slice(0, MAX_INPUT_CHARS);
  const model = getKaiTextModel();

  const response = await client.models.generateContent({
    model,
    contents: truncated,
    config: {
      systemInstruction: buildKaiSystemPrompt(),
      responseMimeType: "application/json",
      responseJsonSchema,
    },
  });

  const outcome = toOutcome(response, startedAt, truncated, model);
  outcome.result = enforceSourceGrounding(outcome.result, truncated);
  return outcome;
}

/**
 * Handles both image (PNG/JPEG/WEBP) and, since the Founder FAT
 * scanned-PDF fix (2026-08-03), raw `application/pdf` bytes. Gemini's
 * `inlineData` part is mimeType-generic and already reads a PDF as a
 * multi-page document (native OCR) with no code change required here —
 * only the prompt text is adjusted so the model knows what it's looking at.
 */
async function runVisionExtraction(
  client: ReturnType<typeof getGeminiTextClient>,
  input: KaiExtractionInput,
  startedAt: number,
): Promise<KaiExtractionOutcome> {
  const model = getKaiVisionModel();
  const isPdf = input.imageMimeType === "application/pdf";

  const response = await client.models.generateContent({
    model,
    contents: [
      {
        role: "user",
        parts: [
          {
            text: isPdf
              ? "Extract the recruitment requirement from this document. It is a scanned/image-only PDF with no text layer — read it visually, page by page."
              : "Extract the recruitment requirement from this image.",
          },
          {
            inlineData: {
              data: input.imageBase64,
              mimeType: input.imageMimeType ?? "image/png",
            },
          },
        ],
      },
    ],
    config: {
      systemInstruction: buildKaiSystemPrompt() + buildKaiVisionPromptAddendum(),
      responseMimeType: "application/json",
      responseJsonSchema,
    },
  });

  return toOutcome(response, startedAt, isPdf ? "(scanned PDF input)" : "(image input)", model);
}

/** Same "no parsed output -> fall back to an empty result" resilience as the OpenAI engine's toOutcome(). */
function toOutcome(
  response: {
    text?: string;
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  },
  startedAt: number,
  fallbackSourceText: string,
  model: string,
): KaiExtractionOutcome {
  const latencyMs = Date.now() - startedAt;
  const usage = {
    inputTokens: response.usageMetadata?.promptTokenCount ?? null,
    outputTokens: response.usageMetadata?.candidatesTokenCount ?? null,
    latencyMs,
  };

  if (!response.text) {
    log.warn({ latencyMs }, "Gemini KAI extraction returned no text output — falling back to an empty result");
    return { result: emptyExtractionResult(fallbackSourceText), model, usage };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(response.text);
  } catch {
    log.warn({ latencyMs }, "Gemini KAI extraction returned non-JSON output — falling back to an empty result");
    return { result: emptyExtractionResult(fallbackSourceText), model, usage };
  }

  const validated = extractionResultSchema.safeParse(parsed);
  if (!validated.success) {
    log.warn(
      { latencyMs, issues: validated.error.issues },
      "Gemini KAI extraction output did not match the extraction schema — falling back to an empty result",
    );
    return { result: emptyExtractionResult(fallbackSourceText), model, usage };
  }

  return { result: validated.data, model, usage };
}

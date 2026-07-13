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

  const outcome = toOutcome(response, startedAt, truncated, getKaiTextModel());
  outcome.result = enforceSourceGrounding(outcome.result, truncated);
  return outcome;
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

/**
 * FIX-008 (extraction): a deterministic backstop for the prompt's "No
 * Hallucination" rule. The system prompt already instructs the model
 * never to invent an employer or benefit — but a prompt instruction is
 * not a guarantee: employer name and benefits are exactly the kind of
 * plausible-sounding, confidently-stated facts a model can still produce
 * even when told not to. Text-based extraction has the literal source
 * text available, so anything the model claims as employer/benefit that
 * does not appear (case-insensitively) anywhere in that source text is
 * provably not grounded in what the recruiter actually wrote, and is
 * dropped here rather than reaching the advertisement. Vision extraction
 * has no independent source text to check against (the model's own
 * transcription of the image *is* the source), so this only applies to
 * PASTE_TEXT/PDF/DOCX-derived plain text.
 */
export function enforceSourceGrounding(result: ExtractionResult, sourceText: string): ExtractionResult {
  const haystack = sourceText.toLowerCase();
  const isGrounded = (value: string) => haystack.includes(value.trim().toLowerCase());

  let employer = result.employer;
  if (employer.value && !isGrounded(employer.value)) {
    log.warn({ value: employer.value }, "Dropping ungrounded employer — not found in source text");
    employer = { value: null, confidence: "LOW" };
  }

  let benefits = result.benefits;
  if (benefits.value) {
    const grounded = benefits.value.filter(isGrounded);
    if (grounded.length !== benefits.value.length) {
      log.warn(
        { dropped: benefits.value.filter((b) => !isGrounded(b)) },
        "Dropping ungrounded benefit(s) — not found in source text",
      );
    }
    benefits = grounded.length > 0 ? { ...benefits, value: grounded } : { value: null, confidence: "LOW" };
  }

  if (employer === result.employer && benefits === result.benefits) return result;
  return { ...result, employer, benefits };
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

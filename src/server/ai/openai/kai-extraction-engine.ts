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
import { chunkText, EXTRACTION_CHUNK_CHARS } from "../text-chunking";
import { mergeExtractionResults, type ChunkExtractionOutcome } from "../extraction-merge";
import { createLogger } from "@/lib/logger";

const log = createLogger("kai-extraction-engine");

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
      throw new AiRateLimitError(error.code ?? undefined);
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

/**
 * Step 6: no source text is silently discarded. Text within
 * EXTRACTION_CHUNK_CHARS of a single call behaves exactly as before (one
 * call, one result). Longer text is split into ordered chunks, every
 * chunk is sent to the model and grounded against its own text, and the
 * structured results are merged (see extraction-merge.ts) so a position
 * appearing after character 20,000 is never lost.
 */
async function runTextExtraction(
  client: ReturnType<typeof getOpenAiClient>,
  text: string,
  startedAt: number,
): Promise<KaiExtractionOutcome> {
  const model = getKaiTextModel();
  const chunks = chunkText(text, EXTRACTION_CHUNK_CHARS);

  log.info(
    {
      sourceChars: text.length,
      chunkCount: chunks.length,
      chunkBoundaries: chunks.map((c) => ({ startChar: c.startChar, endChar: c.endChar })),
    },
    "KAI extraction: source text chunked",
  );

  const outcomes: ChunkExtractionOutcome[] = [];
  let inputTokens = 0;
  let outputTokens = 0;
  let hasTokenUsage = false;

  for (const chunk of chunks) {
    const response = await client.responses.parse({
      model,
      instructions: buildKaiSystemPrompt(),
      input: chunk.text,
      text: { format: zodTextFormat(extractionResultSchema, "kai_extraction_result") },
    });

    const chunkOutcome = toOutcome(response, startedAt, chunk.text, model);
    const grounded = enforceSourceGrounding(chunkOutcome.result, chunk.text);
    outcomes.push({ chunk, result: grounded });

    log.info(
      { chunkIndex: chunk.index, chunkChars: chunk.text.length, positionsFound: grounded.positions.length },
      "KAI extraction: chunk extracted",
    );

    if (chunkOutcome.usage.inputTokens != null) {
      inputTokens += chunkOutcome.usage.inputTokens;
      hasTokenUsage = true;
    }
    if (chunkOutcome.usage.outputTokens != null) {
      outputTokens += chunkOutcome.usage.outputTokens;
      hasTokenUsage = true;
    }
  }

  const merged = mergeExtractionResults(outcomes);
  merged.originalSourceText = text;

  const mergedVacancies = merged.positions.reduce((sum, p) => sum + (p.quantity.value ?? 1), 0);
  log.info(
    { chunkCount: chunks.length, mergedPositions: merged.positions.length, mergedVacancies },
    "KAI extraction: chunk merge complete",
  );

  return {
    result: merged,
    model,
    usage: {
      inputTokens: hasTokenUsage ? inputTokens : null,
      outputTokens: hasTokenUsage ? outputTokens : null,
      latencyMs: Date.now() - startedAt,
    },
  };
}

/**
 * Handles both image (PNG/JPEG/WEBP) and, since the Founder FAT
 * scanned-PDF fix (2026-08-03), raw `application/pdf` bytes. A PDF page
 * has no `input_image` equivalent in the Responses API — OpenAI requires
 * the separate `input_file` content part (`file_data`, a base64 data URL)
 * for document input, which it OCRs/reads natively server-side. This is
 * still the one existing vision call site, not a new capability: a
 * scanned PDF with no text layer is functionally the same "read it
 * visually" request as an uploaded image, just a different content type.
 */
async function runVisionExtraction(
  client: ReturnType<typeof getOpenAiClient>,
  input: KaiExtractionInput,
  startedAt: number,
): Promise<KaiExtractionOutcome> {
  const isPdf = input.imageMimeType === "application/pdf";
  const response = await client.responses.parse({
    model: getKaiVisionModel(),
    instructions: buildKaiSystemPrompt() + buildKaiVisionPromptAddendum(),
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: isPdf
              ? "Extract the recruitment requirement from this document. It is a scanned/image-only PDF with no text layer — read it visually, page by page."
              : "Extract the recruitment requirement from this image.",
          },
          isPdf
            ? {
                type: "input_file",
                filename: "requirement.pdf",
                file_data: `data:application/pdf;base64,${input.imageBase64}`,
              }
            : {
                type: "input_image",
                image_url: `data:${input.imageMimeType ?? "image/png"};base64,${input.imageBase64}`,
                detail: "auto",
              },
        ],
      },
    ],
    text: { format: zodTextFormat(extractionResultSchema, "kai_extraction_result") },
  });

  return toOutcome(response, startedAt, isPdf ? "(scanned PDF input)" : "(image input)", getKaiVisionModel());
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

  // Decision 3: interviewEvents gets the same treatment — a fabricated
  // city/venue for a real recruitment posting is exactly the kind of
  // plausible-sounding, ungrounded detail this guard exists to catch.
  const interviewEvents = result.interviewEvents.filter(
    (event) => !event.venue || isGrounded(event.venue),
  );
  if (interviewEvents.length !== result.interviewEvents.length) {
    log.warn(
      { dropped: result.interviewEvents.filter((event) => event.venue && !isGrounded(event.venue)) },
      "Dropping ungrounded interview event(s) — venue not found in source text",
    );
  }

  if (employer === result.employer && benefits === result.benefits && interviewEvents.length === result.interviewEvents.length) {
    return result;
  }
  return { ...result, employer, benefits, interviewEvents };
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

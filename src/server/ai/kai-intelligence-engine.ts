import { getAiExtractionToolkit, type AiExtractionToolkit } from "@/server/ai";
import { fetchAndProcessSourceFile } from "@/server/ai/document-processing.service";
import { AiInvalidResponseError } from "@/server/ai/openai/errors";
import type { AiExtractionInput } from "@/server/ai/types";
import type { ExtractionResult } from "@/server/ai/extraction-result.schema";
import { ConflictError } from "@/lib/errors";

interface KaiIntelligenceEngineParams {
  sourceType: "PASTE_TEXT" | "PDF" | "DOCX" | "IMAGE" | "WHATSAPP_SCREENSHOT";
  rawText?: string | null;
  sourceFileUrl?: string | null;
  /** Dependency injection seam for tests — pass a fake toolkit instead of the real OpenAI-backed one. */
  toolkit?: AiExtractionToolkit;
}

interface KaiIntelligenceEngineOutcome {
  result: ExtractionResult;
  provider: string;
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number | null;
}

/**
 * The single entry point for turning a draft's source (pasted text or an
 * uploaded file) into a structured ExtractionResult. This is what
 * advertisement-draft.service.ts calls — it never talks to a provider,
 * document parser, or OpenAI client directly.
 *
 * Provider selection happens entirely through the injected/default
 * toolkit (see src/server/ai/index.ts): with a real one configured, this
 * goes through the composite capability in one call; with the Sprint 002
 * NotImplemented stand-ins, every path throws AiProviderNotImplementedError
 * exactly as before — callers (advertisement-draft.service.ts) already
 * handle that as an expected EXTRACTION_FAILED outcome.
 */
export async function runKaiIntelligenceEngine(
  params: KaiIntelligenceEngineParams,
): Promise<KaiIntelligenceEngineOutcome> {
  const toolkit = params.toolkit ?? getAiExtractionToolkit();
  const input = await buildExtractionInput(params);

  if (toolkit.composite) {
    const { result, usage } = await toolkit.composite.extractAll(input);
    if (!result.found || !result.value) {
      throw new AiInvalidResponseError("no structured result was returned");
    }
    return {
      result: result.value,
      provider: toolkit.composite.name,
      model: usage.model,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      latencyMs: usage.latencyMs,
    };
  }

  // No composite capability offered (e.g. a minimal provider implementing
  // only the seven required interfaces). Reassemble from those instead —
  // this loses per-field confidence nuance but stays fully functional.
  return reassembleFromRequiredInterfaces(toolkit, input);
}

async function buildExtractionInput(params: KaiIntelligenceEngineParams): Promise<AiExtractionInput> {
  if (params.sourceType === "PASTE_TEXT") {
    if (!params.rawText) {
      throw new ConflictError("This draft has no pasted text to extract from.");
    }
    return { text: params.rawText, sourceType: params.sourceType };
  }

  if (!params.sourceFileUrl) {
    throw new ConflictError("This draft has no uploaded file to extract from.");
  }

  const processed = await fetchAndProcessSourceFile(params.sourceFileUrl, params.sourceType);
  return processed.kind === "text"
    ? { text: processed.text, sourceType: params.sourceType }
    : { imageBase64: processed.base64, imageMimeType: processed.mimeType, sourceType: params.sourceType };
}

async function reassembleFromRequiredInterfaces(
  toolkit: AiExtractionToolkit,
  input: AiExtractionInput,
): Promise<KaiIntelligenceEngineOutcome> {
  const [requirements, industry, country, employer] = await Promise.all([
    toolkit.requirementExtraction.extractRequirements(input),
    toolkit.industryDetection.detectIndustry(input),
    toolkit.countryDetection.detectCountry(input),
    toolkit.employerDetection.detectEmployer(input),
  ]);

  const emptyField = { value: null, confidence: "LOW" as const };
  const result: ExtractionResult = {
    country: { value: country.value, confidence: "MEDIUM" },
    industry: { value: industry.value, confidence: "MEDIUM" },
    projectType: emptyField,
    employer: { value: employer.value, confidence: "MEDIUM" },
    positions: (requirements.value ?? []).map((p) => ({
      title: p.title,
      tradeSummary: "",
      quantity: { value: p.count ?? null, confidence: "MEDIUM" },
      salaryAmount: emptyField,
      salaryCurrency: emptyField,
      salaryTiers: [],
      experience: { value: p.experience ?? null, confidence: "MEDIUM" },
      qualification: { value: p.qualifications?.[0] ?? null, confidence: "MEDIUM" },
      ageLimit: { value: p.ageRange ?? null, confidence: "MEDIUM" },
      possibleDuplicateOfIndex: null,
    })),
    benefits: { value: null, confidence: "LOW" },
    interviewMode: emptyField,
    interviewDate: emptyField,
    interviewTime: emptyField,
    interviewVenue: emptyField,
    interviewEvents: [],
    contact: { value: null, confidence: "LOW" },
    originalSourceText: input.text ?? "(image input)",
    overallConfidence: "MEDIUM",
    warnings: ["Assembled from individual providers — some detail (trade summaries, salary) is unavailable."],
  };

  return {
    result,
    provider: toolkit.requirementExtraction.name,
    model: null,
    inputTokens: null,
    outputTokens: null,
    latencyMs: null,
  };
}

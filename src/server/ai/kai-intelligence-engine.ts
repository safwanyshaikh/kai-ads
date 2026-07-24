import { getAiExtractionToolkit, type AiExtractionToolkit } from "@/server/ai";
import { fetchAndProcessSourceFile } from "@/server/ai/document-processing.service";
import { buildMergedExtractionText, type AttachmentText } from "@/server/ai/extraction-input-merge";
import { AiInvalidResponseError } from "@/server/ai/openai/errors";
import type { AiExtractionInput } from "@/server/ai/types";
import type { ExtractionResult } from "@/server/ai/extraction-result.schema";
import { ConflictError } from "@/lib/errors";

/** One staged composer attachment as stored on AdvertisementDraft.attachments. */
export interface DraftAttachment {
  url: string;
  sourceType: "PDF" | "DOCX" | "IMAGE" | "WHATSAPP_SCREENSHOT";
  fileName: string;
  mimeType: string;
}

interface KaiIntelligenceEngineParams {
  sourceType: "PASTE_TEXT" | "PDF" | "DOCX" | "IMAGE" | "WHATSAPP_SCREENSHOT";
  rawText?: string | null;
  sourceFileUrl?: string | null;
  /** ChatGPT-style composer: typed guidance accompanying the sources. */
  instructions?: string | null;
  /** ChatGPT-style composer: every staged file. When set, sourceFileUrl is unused. */
  attachments?: DraftAttachment[] | null;
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
  const { input, mergeWarnings } = await buildExtractionInput(params);

  if (toolkit.composite) {
    const { result, usage } = await toolkit.composite.extractAll(input);
    if (!result.found || !result.value) {
      throw new AiInvalidResponseError("no structured result was returned");
    }
    // Composer merge caveats (e.g. an image attachment that couldn't be
    // transcribed alongside text sources) surface as ordinary extraction
    // warnings — visible to the recruiter, never silently dropped.
    result.value.warnings = [...result.value.warnings, ...mergeWarnings];
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
  const outcome = await reassembleFromRequiredInterfaces(toolkit, input);
  outcome.result.warnings = [...outcome.result.warnings, ...mergeWarnings];
  return outcome;
}

interface BuiltExtractionInput {
  input: AiExtractionInput;
  /** Merge caveats to append to the extraction result's warnings — never content. */
  mergeWarnings: string[];
}

/**
 * ChatGPT-style composer path: several attachments and/or typed
 * instructions on one draft. Every PDF/DOCX attachment is converted to
 * text through the same processing pipeline a single upload uses; the
 * texts are then merged (instructions -> rawText -> attachments, see
 * buildMergedExtractionText) into one text input.
 *
 * Images are the constraint: the provider contract (AiExtractionInput)
 * accepts exactly one image, and there is no standalone per-image
 * transcription capability to call once per screenshot — so rather than
 * invent one (or worse, invent content), images fall back deliberately:
 * with no text from any source, the FIRST image goes through the
 * existing single-image vision path and the rest are reported skipped;
 * with text present, the text wins and the images are reported as noted
 * but not transcribed. NEVER fabricated — Truth Brain (Principle 1).
 */
async function buildComposerExtractionInput(
  params: KaiIntelligenceEngineParams,
): Promise<BuiltExtractionInput> {
  const attachments = params.attachments ?? [];
  const documentAttachments = attachments.filter(
    (a) => a.sourceType === "PDF" || a.sourceType === "DOCX",
  );
  const imageAttachments = attachments.filter(
    (a) => a.sourceType === "IMAGE" || a.sourceType === "WHATSAPP_SCREENSHOT",
  );

  // Sequential on purpose: each fetch+parse can be memory-heavy (15MB
  // cap per file) and attachment counts are small (max 10).
  const attachmentTexts: AttachmentText[] = [];
  for (const attachment of documentAttachments) {
    const processed = await fetchAndProcessSourceFile(attachment.url, attachment.sourceType);
    if (processed.kind === "text") {
      attachmentTexts.push({ fileName: attachment.fileName, text: processed.text });
    }
  }

  const mergedText = buildMergedExtractionText({
    instructions: params.instructions,
    rawText: params.rawText,
    attachmentTexts,
  });

  if (mergedText) {
    const mergeWarnings =
      imageAttachments.length > 0
        ? [
            `Image attachment(s) ${imageAttachments.map((a) => a.fileName).join(", ")} were noted but not transcribed — extraction used the text sources.`,
          ]
        : [];
    return { input: { text: mergedText, sourceType: params.sourceType }, mergeWarnings };
  }

  if (imageAttachments.length > 0) {
    const [first, ...skipped] = imageAttachments;
    const processed = await fetchAndProcessSourceFile(first.url, first.sourceType);
    if (processed.kind !== "text") {
      const mergeWarnings =
        skipped.length > 0
          ? [
              `Only the first image (${first.fileName}) was read — skipped: ${skipped.map((a) => a.fileName).join(", ")}.`,
            ]
          : [];
      return {
        input: {
          imageBase64: processed.base64,
          imageMimeType: processed.mimeType,
          sourceType: first.sourceType,
        },
        mergeWarnings,
      };
    }
  }

  throw new ConflictError("None of this draft's sources contained anything to extract from.");
}

async function buildExtractionInput(params: KaiIntelligenceEngineParams): Promise<BuiltExtractionInput> {
  // Composer drafts (attachments and/or instructions) take the merged
  // multi-source path; everything else is the original single-source
  // behavior, byte for byte.
  if ((params.attachments && params.attachments.length > 0) || params.instructions) {
    return buildComposerExtractionInput(params);
  }

  if (params.sourceType === "PASTE_TEXT") {
    if (!params.rawText) {
      throw new ConflictError("This draft has no pasted text to extract from.");
    }
    return { input: { text: params.rawText, sourceType: params.sourceType }, mergeWarnings: [] };
  }

  if (!params.sourceFileUrl) {
    throw new ConflictError("This draft has no uploaded file to extract from.");
  }

  const processed = await fetchAndProcessSourceFile(params.sourceFileUrl, params.sourceType);
  return {
    input:
      processed.kind === "text"
        ? { text: processed.text, sourceType: params.sourceType }
        : { imageBase64: processed.base64, imageMimeType: processed.mimeType, sourceType: params.sourceType },
    mergeWarnings: [],
  };
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

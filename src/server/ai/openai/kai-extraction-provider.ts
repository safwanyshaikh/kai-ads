import { createHash } from "node:crypto";
import type {
  CompositeExtractionProvider,
  CountryDetectionProvider,
  EmployerDetectionProvider,
  ExtractedInterview,
  ExtractedPosition as ProviderExtractedPosition,
  ExtractedSalary,
  IndustryDetectionProvider,
  InterviewDetectionProvider,
  RequirementExtractionProvider,
  SalaryDetectionProvider,
  TradeSummaryProvider,
} from "../extraction-providers.interface";
import type { AiExtractionInput, AiExtractionResult } from "../types";
import { runKaiExtraction, type KaiExtractionOutcome } from "./kai-extraction-engine";
import type { ExtractionResult } from "../extraction-result.schema";

const MAX_CACHE_ENTRIES = 50;

function cacheKey(input: AiExtractionInput): string {
  const basis = input.text ?? input.imageBase64 ?? "";
  return createHash("sha256").update(basis).digest("hex");
}

/**
 * Implements all seven Sprint 002 provider interfaces against one shared
 * OpenAI call. Each interface method is independently correct and
 * callable on its own (provider independence is preserved) — the
 * memoization here is a cost/latency optimization for the common case
 * (advertisement-draft.service.ts calls all seven for the same input),
 * not a change to what each interface promises.
 */
export class KaiOpenAiExtractionProvider
  implements
    RequirementExtractionProvider,
    TradeSummaryProvider,
    IndustryDetectionProvider,
    CountryDetectionProvider,
    EmployerDetectionProvider,
    SalaryDetectionProvider,
    InterviewDetectionProvider,
    CompositeExtractionProvider
{
  readonly name = "openai";

  private cache = new Map<string, Promise<KaiExtractionOutcome>>();

  /** Exposed so callers (advertisement-draft.service.ts) can get token/latency usage for cost tracking without a second call. */
  async runComposite(input: AiExtractionInput): Promise<KaiExtractionOutcome> {
    const key = cacheKey(input);
    const cached = this.cache.get(key);
    if (cached) return cached;

    const promise = runKaiExtraction({
      text: input.text,
      imageBase64: input.imageBase64,
      imageMimeType: input.imageMimeType,
    });
    this.cache.set(key, promise);

    if (this.cache.size > MAX_CACHE_ENTRIES) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }

    try {
      return await promise;
    } catch (error) {
      this.cache.delete(key); // don't memoize a failure
      throw error;
    }
  }

  async extractRequirements(
    input: AiExtractionInput,
  ): Promise<AiExtractionResult<ProviderExtractedPosition[]>> {
    const { result } = await this.runComposite(input);
    return {
      found: result.positions.length > 0,
      value: result.positions.map(toProviderPosition),
    };
  }

  async summarizeTrade(input: AiExtractionInput): Promise<AiExtractionResult<string>> {
    const { result } = await this.runComposite(input);
    const summaries = result.positions.map((p) => p.tradeSummary).filter(Boolean);
    return {
      found: summaries.length > 0,
      value: summaries.length > 0 ? summaries.join(" ") : null,
    };
  }

  async detectIndustry(input: AiExtractionInput): Promise<AiExtractionResult<string>> {
    const { result } = await this.runComposite(input);
    return toResult(result.industry);
  }

  async detectCountry(input: AiExtractionInput): Promise<AiExtractionResult<string>> {
    const { result } = await this.runComposite(input);
    return toResult(result.country);
  }

  async detectEmployer(input: AiExtractionInput): Promise<AiExtractionResult<string>> {
    const { result } = await this.runComposite(input);
    return toResult(result.employer);
  }

  async detectSalary(input: AiExtractionInput): Promise<AiExtractionResult<ExtractedSalary[]>> {
    const { result } = await this.runComposite(input);
    const salaries: ExtractedSalary[] = result.positions
      .filter((p) => p.salaryAmount.value !== null)
      .map((p) => ({
        amount: p.salaryAmount.value ?? undefined,
        currency: p.salaryCurrency.value ?? undefined,
        raw: `${p.title}: ${p.salaryAmount.value ?? "?"} ${p.salaryCurrency.value ?? ""}`.trim(),
      }));
    return { found: salaries.length > 0, value: salaries.length > 0 ? salaries : null };
  }

  async detectInterview(input: AiExtractionInput): Promise<AiExtractionResult<ExtractedInterview>> {
    const { result } = await this.runComposite(input);
    const hasAny =
      result.interviewDate.value || result.interviewVenue.value || result.interviewMode.value;
    if (!hasAny) return { found: false, value: null };

    return {
      found: true,
      value: {
        date: result.interviewDate.value ?? undefined,
        location: result.interviewVenue.value ?? undefined,
        mode: result.interviewMode.value ?? undefined,
        raw: [result.interviewDate.value, result.interviewVenue.value]
          .filter(Boolean)
          .join(" · "),
      },
    };
  }

  /** CompositeExtractionProvider — the full, rich result in one call, plus usage for cost tracking. */
  async extractAll(input: AiExtractionInput) {
    const outcome = await this.runComposite(input);
    return {
      result: { found: true, value: outcome.result } as AiExtractionResult<ExtractionResult>,
      usage: { ...outcome.usage, model: outcome.model },
    };
  }
}

function toResult(field: { value: string | null }): AiExtractionResult<string> {
  return { found: field.value !== null, value: field.value };
}

function toProviderPosition(position: ExtractionResult["positions"][number]): ProviderExtractedPosition {
  return {
    title: position.title,
    count: position.quantity.value ?? undefined,
    experience: position.experience.value ?? undefined,
    ageRange: position.ageLimit.value ?? undefined,
    qualifications: position.qualification.value ? [position.qualification.value] : undefined,
  };
}

import type { AiExtractionInput, AiExtractionResult } from "./types";
import { AiProviderNotImplementedError } from "./types";
import type {
  CountryDetectionProvider,
  EmployerDetectionProvider,
  ExtractedInterview,
  ExtractedPosition,
  ExtractedSalary,
  IndustryDetectionProvider,
  InterviewDetectionProvider,
  RequirementExtractionProvider,
  SalaryDetectionProvider,
  TradeSummaryProvider,
} from "./extraction-providers.interface";

/**
 * "Not implemented" stand-ins for every AI extraction interface.
 *
 * Sprint 002 ships architecture only — no GPT/OpenAI/Claude call exists
 * anywhere in this codebase. These classes exist so:
 *   1. The rest of the app (draft service, review screen) has something
 *      real to call and can handle "AI unavailable, fall back to manual
 *      entry" as a first-class, tested code path rather than an
 *      afterthought.
 *   2. A future sprint adds a real provider by implementing the
 *      interface and swapping it in `index.ts` below — no other file
 *      changes.
 *
 * Every method throws AiProviderNotImplementedError instead of
 * returning a fake result — consistent with this codebase's existing
 * rule (see email/storage Null providers) that "not configured" is
 * always an explicit, loud failure, never a silent mock.
 */
export class NotImplementedRequirementExtractionProvider
  implements RequirementExtractionProvider
{
  readonly name = "not-implemented";
  async extractRequirements(
    _input: AiExtractionInput,
  ): Promise<AiExtractionResult<ExtractedPosition[]>> {
    throw new AiProviderNotImplementedError("RequirementExtractionProvider");
  }
}

export class NotImplementedTradeSummaryProvider implements TradeSummaryProvider {
  readonly name = "not-implemented";
  async summarizeTrade(_input: AiExtractionInput): Promise<AiExtractionResult<string>> {
    throw new AiProviderNotImplementedError("TradeSummaryProvider");
  }
}

export class NotImplementedIndustryDetectionProvider
  implements IndustryDetectionProvider
{
  readonly name = "not-implemented";
  async detectIndustry(_input: AiExtractionInput): Promise<AiExtractionResult<string>> {
    throw new AiProviderNotImplementedError("IndustryDetectionProvider");
  }
}

export class NotImplementedCountryDetectionProvider
  implements CountryDetectionProvider
{
  readonly name = "not-implemented";
  async detectCountry(_input: AiExtractionInput): Promise<AiExtractionResult<string>> {
    throw new AiProviderNotImplementedError("CountryDetectionProvider");
  }
}

export class NotImplementedEmployerDetectionProvider
  implements EmployerDetectionProvider
{
  readonly name = "not-implemented";
  async detectEmployer(_input: AiExtractionInput): Promise<AiExtractionResult<string>> {
    throw new AiProviderNotImplementedError("EmployerDetectionProvider");
  }
}

export class NotImplementedSalaryDetectionProvider
  implements SalaryDetectionProvider
{
  readonly name = "not-implemented";
  async detectSalary(
    _input: AiExtractionInput,
  ): Promise<AiExtractionResult<ExtractedSalary[]>> {
    throw new AiProviderNotImplementedError("SalaryDetectionProvider");
  }
}

export class NotImplementedInterviewDetectionProvider
  implements InterviewDetectionProvider
{
  readonly name = "not-implemented";
  async detectInterview(
    _input: AiExtractionInput,
  ): Promise<AiExtractionResult<ExtractedInterview>> {
    throw new AiProviderNotImplementedError("InterviewDetectionProvider");
  }
}

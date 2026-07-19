import type { ExtractionResult } from "@/server/ai/extraction-result.schema";
import {
  createAdvertisementSchema,
  type CreateAdvertisementInput,
} from "@/lib/validations/advertisement";
import { extractionResultToFormValues } from "@/lib/extraction-to-form";

/**
 * Sprint 006 workflow replacement: Paste → AI Extraction → Truth Brain →
 * Creative Director → Generate → Canvas. There is no Review form step —
 * the AI populates everything, the recruiter edits exceptions directly on
 * the advertisement canvas.
 *
 * This planner is the one decision point between the two paths:
 *
 *  - AUTO: the extraction produced enough grounded facts to satisfy the
 *    advertisement schema (header derivable, industry, country, ≥1
 *    position). The draft is reviewed/saved/generated automatically and
 *    the user lands on the canvas.
 *  - MANUAL: extraction failed or the grounded facts are insufficient to
 *    create a valid advertisement record. Truth Brain forbids inventing
 *    the missing facts, so the ONLY honest path is asking the recruiter
 *    for them — this is the exception path, not the normal flow.
 *
 * Pure function so the auto/manual decision is unit-testable without a
 * browser.
 */
export type AutoPublishPlan =
  | { mode: "auto"; input: CreateAdvertisementInput }
  | { mode: "manual"; reason: string; partial: Partial<CreateAdvertisementInput> };

export function planAutoPublish(extracted: ExtractionResult): AutoPublishPlan {
  const mapped = extractionResultToFormValues(extracted);
  const candidate = { style: "VISUAL" as const, ...mapped };

  const parsed = createAdvertisementSchema.safeParse(candidate);
  if (parsed.success) {
    return { mode: "auto", input: parsed.data };
  }

  const missing = [...new Set(parsed.error.issues.map((issue) => String(issue.path[0])))];
  return {
    mode: "manual",
    reason:
      `The AI could not find every required fact in the source (${missing.join(", ")}). ` +
      "Fill in only what's missing — nothing is ever invented for you.",
    partial: mapped,
  };
}

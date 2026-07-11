import type { AdvertisementStyle } from "@prisma/client";
import type { DensityLevel } from "./density-classification.service";

interface TypeRecommendationInput {
  density: DensityLevel;
  hasSalaryInfo: boolean;
  isUrgent: boolean;
  hasEmployerLogo: boolean;
}

interface TypeRecommendation {
  style: AdvertisementStyle;
  reason: string;
}

/**
 * "KAI Recommends Advertisement Type" / "User May Accept or Change Type."
 * This is a recommendation, never a hard constraint — the recruiter can
 * always override it (enforced at the API layer: the generate endpoint
 * accepts an explicit `style`, this function only supplies the default).
 *
 * Rules, most specific first:
 * - HIGH density (20-30 positions) never gets the image-heavy Visual
 *   style — "Never force a high-density requirement into a visual-heavy
 *   layout that makes positions unreadable." DTP/Newspaper is built for
 *   exactly this: dense, structured, high information density.
 * - Urgent or salary-focused requirements favor Typography — fast to
 *   scan, no imagery competing with the number that matters.
 * - LOW density with no urgency is the one case Visual actually serves
 *   well: a single critical requirement is a good candidate for a
 *   high-impact social image.
 * - Everything else (MEDIUM density, no strong signal) defaults to
 *   Typography — safest general-purpose choice, matches the brief's
 *   "multiple positions" -> Typography guidance.
 */
export function recommendAdvertisementType(input: TypeRecommendationInput): TypeRecommendation {
  if (input.density === "HIGH") {
    return {
      style: "NEWSPAPER",
      reason: "High position density reads best in a dense, structured DTP/newspaper layout.",
    };
  }

  if (input.isUrgent || input.hasSalaryInfo) {
    return {
      style: "TYPOGRAPHY",
      reason: input.isUrgent
        ? "Urgent requirements are scanned fast — typography-led layouts read quicker than imagery."
        : "Salary-focused requirements read best with the figure front and center, not competing with imagery.",
    };
  }

  if (input.density === "LOW") {
    return {
      style: "VISUAL",
      reason: "A single critical requirement is a strong candidate for a high-impact visual advertisement.",
    };
  }

  return {
    style: "TYPOGRAPHY",
    reason: "Multiple positions read most clearly with a structured, typography-led layout.",
  };
}

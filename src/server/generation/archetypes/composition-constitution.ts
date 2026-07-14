import type { AdvertisementArchetype, AdvertisementFacts } from "./types";
import type { AdCopyPlan } from "./advertisement-intelligence";
import { coreHeaderText } from "./advertisement-intelligence";
import { escapeXml } from "./composition-shared";

/**
 * ADVERTISEMENT COMPOSITION CONSTITUTION — runtime enforcement.
 *
 * The canonical law lives in the repository constitution below; this
 * module is its executable arm. composeAdvertisement() (the single
 * dispatch every archetype renders through) calls
 * buildCompositionDirectives() before rendering and
 * enforceCompositionConstitution() after rendering, so no archetype —
 * current or future — can bypass the Constitution or invent conflicting
 * hierarchy rules.
 */
export const ADVERTISEMENT_COMPOSITION_CONSTITUTION_PATH =
  "docs/008_ADVERTISEMENT_COMPOSITION_CONSTITUTION.md";

/** Content Density Engine classes (Constitution, Article V §22). */
export type ContentDensityClass = "SPARSE" | "MEDIUM" | "HIGH";

/** Footer Composition System variants (Constitution, Article V §24). */
export type FooterVariant = "TRUST_STRIP" | "PRINT_SMALL_PRINT";

/** Information Priority Engine items, ordered most→least prominent (§20). */
export type InformationPriorityItem =
  | "DOMINANT_HOOK"
  | "DESTINATION_COUNTRY"
  | "COMPENSATION"
  | "INTERVIEW_EVENTS"
  | "POSITIONS"
  | "CONTACT_CTA"
  | "AGENCY_TRUST";

export interface CompositionDirectives {
  /** Ordered visual priority; AGENCY_TRUST is constitutionally always last (§11, §20). */
  informationPriority: InformationPriorityItem[];
  /** The strongest truthful candidate-facing hook (largest text on canvas, §5). */
  dominantHook: string;
  contentDensityClass: ContentDensityClass;
  /**
   * Typography Scale Engine output (§14, §21): sparse content scales UP
   * so a short category list never yields miniature fonts in an empty
   * document; dense content is held slightly tighter so tables breathe.
   * Folded into every engine's headline sizing by composeAdvertisement.
   */
  typographyScale: number;
  footerVariant: FooterVariant;
}

/**
 * Content Density Engine (§22). Positions volume leads the decision —
 * the density class must reflect what actually has to fit on the canvas,
 * not the archetype someone is in the habit of using (§18).
 */
export function classifyContentDensity(facts: AdvertisementFacts): ContentDensityClass {
  const blocks =
    facts.positions.length +
    facts.benefits.length +
    facts.interview.length +
    (facts.footer ? 1 : 0) +
    (facts.employer ? 1 : 0);
  if (facts.positions.length <= 2 && blocks <= 6) return "SPARSE";
  if (facts.positions.length >= 8 || blocks >= 14) return "HIGH";
  return "MEDIUM";
}

const TYPOGRAPHY_SCALE: Record<ContentDensityClass, number> = {
  SPARSE: 1.18,
  MEDIUM: 1,
  HIGH: 0.94,
};

export function buildCompositionDirectives(
  facts: AdvertisementFacts,
  options: { archetype: AdvertisementArchetype; copy?: AdCopyPlan | null },
): CompositionDirectives {
  const contentDensityClass = classifyContentDensity(facts);
  const informationPriority: InformationPriorityItem[] = ["DOMINANT_HOOK", "DESTINATION_COUNTRY"];
  if (facts.benefits.length > 0) informationPriority.push("COMPENSATION");
  if (facts.interview.length > 0) informationPriority.push("INTERVIEW_EVENTS");
  informationPriority.push("POSITIONS", "CONTACT_CTA", "AGENCY_TRUST");

  const core = coreHeaderText(facts.header, facts.country).toUpperCase();
  const dominantHook = options.copy?.hookLines?.length
    ? options.copy.hookLines.join(" ")
    : facts.country && !core.includes(facts.country.toUpperCase())
      ? `${core} IN ${facts.country.toUpperCase()}`
      : core;

  return {
    informationPriority,
    dominantHook,
    contentDensityClass,
    typographyScale: TYPOGRAPHY_SCALE[contentDensityClass],
    footerVariant: options.archetype === "DTP_NEWSPAPER" ? "PRINT_SMALL_PRINT" : "TRUST_STRIP",
  };
}

export class CompositionConstitutionViolation extends Error {
  readonly failures: string[];
  constructor(failures: string[]) {
    super(
      `Advertisement Composition Constitution violated (${ADVERTISEMENT_COMPOSITION_CONSTITUTION_PATH}): ${failures.join("; ")}`,
    );
    this.name = "CompositionConstitutionViolation";
    this.failures = failures;
  }
}

/**
 * Post-render constitutional gate. Checks the laws that are decidable
 * from the SVG itself: the dominant hook actually rendered (§5), the
 * footer trust architecture is present (§11, §24), and the contact CTA
 * exists whenever the source provides contact details (§10). Subjective
 * laws (mobile scale, dead canvas, benchmark hierarchy) are enforced by
 * Brain D's mandatory rejection conditions on the rasterized output.
 */
export function enforceCompositionConstitution(
  svg: string,
  facts: AdvertisementFacts,
  directives: CompositionDirectives,
): void {
  // Embedded-font <style> base64 can coincidentally contain any letter
  // sequence, so it is stripped before checking recruiter-facing content.
  const canvas = svg.replace(/<style>[\s\S]*?<\/style>/g, "").toLowerCase();
  const failures: string[] = [];
  const requireText = (law: string, value: string | null | undefined) => {
    if (!value) return;
    if (canvas.includes(escapeXml(value).toLowerCase())) return;
    // Engines legitimately wrap long strings across <text> lines, so fall
    // back to word-level presence (same policy as the Gate A fidelity check).
    const words = value.split(/\s+/).filter((w) => w.length > 1);
    if (words.length > 1 && words.every((w) => canvas.includes(escapeXml(w).toLowerCase()))) return;
    failures.push(`${law}: "${value}" not rendered`);
  };

  requireText("§5 dominant hook", coreHeaderText(facts.header, facts.country));
  requireText("§24 footer trust — agency identity", facts.agencyName);
  if (facts.raLicenseId) requireText("§24 footer trust — RA license", `RA ${facts.raLicenseId}`);
  if (!canvas.includes("scan to verify")) {
    failures.push("§24 footer trust: KAI verification caption missing");
  }
  if (directives.footerVariant === "PRINT_SMALL_PRINT") {
    // The print grammar prints the FULL official registration verbatim.
    requireText("§24 footer trust — full registration (print variant)", facts.fullRegistrationNumber);
  }
  requireText("§10 contact CTA — phone", facts.contact.phone);
  requireText("§10 contact CTA — email", facts.contact.email);
  requireText("§6 destination country", facts.country);

  if (failures.length > 0) {
    throw new CompositionConstitutionViolation(failures);
  }
}

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

/**
 * Where each trust element's canonical rendering location is. The
 * primaryTrustZone is the single integrated trust footer — elements
 * appear here and only here unless an explicit justification overrides.
 */
export type TrustZone = "FOOTER";

export interface TrustArchitecture {
  primaryTrustZone: TrustZone;
  /** Elements that the deduplication layer determined should NOT repeat outside the footer. */
  repeatedElements: RepeatedElement[];
  /** Canvas percentage reclaimed from deduplication, to be allocated to candidate-facing content. */
  reclaimedCanvasPercent: number;
  /** What the reclaimed space should be filled with (ordered by priority). */
  reclaimedCanvasAllocation: ReclaimedCanvasTarget[];
}

export interface RepeatedElement {
  element: "AGENCY_NAME" | "AGENCY_LOGO" | "RA_NUMBER" | "MEA_BADGE" | "REGISTRATION_NUMBER" | "VERIFICATION_MESSAGING";
  repetitionJustification: string | null;
}

export type ReclaimedCanvasTarget =
  | "CANDIDATE_HOOK"
  | "DESTINATION_EMPHASIS"
  | "INTERVIEW_PROMINENCE"
  | "BENEFIT_PROMINENCE"
  | "POSITION_EMPHASIS"
  | "CTA_PROMINENCE";

/**
 * Source-grounded candidate hook — a truthful advertising reframe of
 * the opportunity that is more compelling than the raw header text.
 * Every word must trace to source evidence.
 */
export interface CandidateHook {
  text: string;
  candidateHookType: "DESTINATION_CAREER" | "PROJECT_OPPORTUNITY" | "TRADE_DEMAND" | "INTERVIEW_URGENCY" | "HEADER_DIRECT";
  candidateHookSourceEvidence: string[];
  candidateHookConfidence: "HIGH" | "MEDIUM";
}

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
  /** Information deduplication: where trust elements render and what doesn't repeat. */
  trustArchitecture: TrustArchitecture;
  /** Source-grounded candidate hook for reclaimed canvas space. */
  candidateHook: CandidateHook | null;
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

/**
 * Analyzes trust elements for unjustified repetition. The default is ONE
 * integrated trust footer — elements do not repeat outside it unless
 * there is an explicit commercial, comprehension, conversion, legal,
 * or trust justification.
 */
export function buildTrustArchitecture(
  facts: AdvertisementFacts,
  archetype: AdvertisementArchetype,
): TrustArchitecture {
  const repeatedElements: RepeatedElement[] = [
    { element: "AGENCY_NAME", repetitionJustification: null },
    { element: "AGENCY_LOGO", repetitionJustification: null },
    { element: "RA_NUMBER", repetitionJustification: null },
    { element: "MEA_BADGE", repetitionJustification: null },
    { element: "REGISTRATION_NUMBER", repetitionJustification: null },
    { element: "VERIFICATION_MESSAGING", repetitionJustification: null },
  ];

  // DTP/Newspaper: the print grammar traditionally shows agency masthead
  // at top AND registration at bottom — justified by print convention.
  if (archetype === "DTP_NEWSPAPER") {
    const agencyName = repeatedElements.find((e) => e.element === "AGENCY_NAME")!;
    agencyName.repetitionJustification = "DTP print convention: centered masthead is the genre's trust architecture";
  }

  // Reclaimed canvas: removing top-area trust duplication reclaims ~8-12%
  // of premium canvas for candidate-facing content.
  const reclaimedCanvasPercent = archetype === "DTP_NEWSPAPER" ? 0 : 10;

  const reclaimedCanvasAllocation: ReclaimedCanvasTarget[] = [];
  if (reclaimedCanvasPercent > 0) {
    reclaimedCanvasAllocation.push("CANDIDATE_HOOK", "DESTINATION_EMPHASIS");
    if (facts.interview.length > 0) reclaimedCanvasAllocation.push("INTERVIEW_PROMINENCE");
    if (facts.benefits.length > 0) reclaimedCanvasAllocation.push("BENEFIT_PROMINENCE");
  }

  return {
    primaryTrustZone: "FOOTER",
    repeatedElements,
    reclaimedCanvasPercent,
    reclaimedCanvasAllocation,
  };
}

/**
 * Builds a source-grounded candidate hook — a truthful advertising
 * reframe more compelling than the raw header. Every word traces to
 * source evidence. Never invents urgency, salary, vacancy count,
 * employer prestige, or benefits not in the source.
 */
export function buildCandidateHook(facts: AdvertisementFacts): CandidateHook | null {
  const country = facts.country;
  const employer = facts.employer;
  const industry = facts.industry;
  const core = coreHeaderText(facts.header, country);

  // Career-destination hook: when there's a clear country + industry
  if (country && industry && employer) {
    return {
      text: `YOUR ${industry.toUpperCase()} CAREER IN ${country.toUpperCase()}`,
      candidateHookType: "DESTINATION_CAREER",
      candidateHookSourceEvidence: [
        `country: ${country}`,
        `industry: ${industry}`,
        `employer: ${employer}`,
      ],
      candidateHookConfidence: "HIGH",
    };
  }

  // Project opportunity hook
  if (country && core.length > 8) {
    return {
      text: `${core.toUpperCase()} — ${country.toUpperCase()}`,
      candidateHookType: "PROJECT_OPPORTUNITY",
      candidateHookSourceEvidence: [
        `header: ${facts.header}`,
        `country: ${country}`,
      ],
      candidateHookConfidence: "HIGH",
    };
  }

  // Trade demand hook for specific positions
  if (facts.positions.length === 1) {
    return {
      text: `${facts.positions[0].title.toUpperCase()} REQUIRED FOR ${country.toUpperCase()}`,
      candidateHookType: "TRADE_DEMAND",
      candidateHookSourceEvidence: [
        `position: ${facts.positions[0].title}`,
        `country: ${country}`,
      ],
      candidateHookConfidence: "HIGH",
    };
  }

  return null;
}

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
    trustArchitecture: buildTrustArchitecture(facts, options.archetype),
    candidateHook: buildCandidateHook(facts),
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
 *
 * AI-FIRST MODE: when the SVG contains a full-bleed GPT-generated
 * advertisement image, content facts (hook, country, contact, positions)
 * are rendered INSIDE the raster image by GPT — they exist in the image
 * but NOT as SVG <text> elements. Only the precision overlay elements
 * (agency name, RA, scan caption, QR) are SVG text. The gate checks
 * only what the precision overlay guarantees; Brain D validates the
 * rest from the rasterized output.
 */
export function enforceCompositionConstitution(
  svg: string,
  facts: AdvertisementFacts,
  directives: CompositionDirectives,
): void {
  const canvas = svg.replace(/<style>[\s\S]*?<\/style>/g, "").toLowerCase();
  const failures: string[] = [];
  const requireText = (law: string, value: string | null | undefined) => {
    if (!value) return;
    if (canvas.includes(escapeXml(value).toLowerCase())) return;
    const words = value.split(/\s+/).filter((w) => w.length > 1);
    if (words.length > 1 && words.every((w) => canvas.includes(escapeXml(w).toLowerCase()))) return;
    failures.push(`${law}: "${value}" not rendered`);
  };

  // Detect AI-first mode: a full-bleed <image> with a data URI means GPT
  // generated the main advertisement composition. Content facts are inside
  // the raster — only precision overlay elements are checkable as SVG text.
  const isAiFirst = svg.includes('href="data:image/png;base64,') && svg.includes('preserveAspectRatio="xMidYMid slice"');

  if (!isAiFirst) {
    // Full deterministic mode: all content is SVG text, check everything
    requireText("§5 dominant hook", coreHeaderText(facts.header, facts.country));
    requireText("§10 contact CTA — phone", facts.contact.phone);
    requireText("§10 contact CTA — email", facts.contact.email);
    requireText("§6 destination country", facts.country);
  }
  // In AI-first mode, hook/country/contact/positions are rendered by GPT
  // inside the raster image — Brain D validates them from the final PNG.
  // The precision overlay guarantees only trust/verification elements.

  // Trust architecture is ALWAYS guaranteed by KAI's precision overlay
  requireText("§24 footer trust — agency identity", facts.agencyName);
  if (facts.raLicenseId) requireText("§24 footer trust — RA license", `RA ${facts.raLicenseId}`);
  if (!canvas.includes("scan to verify")) {
    failures.push("§24 footer trust: KAI verification caption missing");
  }
  if (directives.footerVariant === "PRINT_SMALL_PRINT") {
    requireText("§24 footer trust — full registration (print variant)", facts.fullRegistrationNumber);
  }

  if (failures.length > 0) {
    throw new CompositionConstitutionViolation(failures);
  }
}

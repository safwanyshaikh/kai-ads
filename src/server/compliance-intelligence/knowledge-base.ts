/**
 * Compliance Intelligence — the compliance knowledge base.
 *
 *   ... -> JobOrder Intelligence -> **Compliance Intelligence** -> ...
 *
 * THE ONLY SOURCE OF LEGAL TRUTH IN THIS ENGINE.
 *
 * Task 004's binding rule: the engine must NEVER invent a legal
 * requirement. If a rule is not in this file, the answer is UNKNOWN.
 * There is no fallback, no inference from a neighbouring corridor, and
 * no "probably the same as Saudi". A recruitment agency acting on an
 * invented legal requirement — or on a false assurance that none
 * applies — can lose its licence.
 *
 * COVERAGE IS DECLARED, NOT ASSUMED
 *
 * COVERED_ORIGINS and COVERED_DESTINATIONS below state exactly which
 * corridors this knowledge base speaks for. For anything outside them the
 * engine reports UNKNOWN — never "no requirements found". Those two
 * answers look similar in a UI and are opposites in a courtroom: one says
 * we checked, the other says we cannot.
 *
 * EVERY RULE CARRIES ITS REVIEW STATUS
 *
 * Rules seeded here are drawn from publicly documented instruments and
 * are marked REQUIRES_LEGAL_REVIEW. That status is surfaced on every
 * determination the rule produces, so nothing reads as settled legal
 * advice until a qualified reviewer marks it REVIEWED. No article or
 * section number is stated unless it is genuinely known — `citation`
 * says "general provision" rather than inventing a precise reference,
 * because a fabricated citation is worse than none.
 *
 * DATA, NOT CODE. A new corridor is new rows plus a coverage entry.
 */

import { PROHIBITED_BRANDING_TERMS, PROHIBITED_PHRASES } from "@/server/generation/prohibited-claims.service";

export type ComplianceCategory =
  | "EMPLOYER_DISCLOSURE"
  | "AGENCY_DISCLOSURE"
  | "COUNTRY_RULE"
  | "CORRIDOR_RULE"
  | "MANDATORY_WARNING"
  | "LEGAL_STATEMENT"
  | "TRUST_ELEMENT"
  | "FORBIDDEN_CLAIM";

export const COMPLIANCE_CATEGORIES: ComplianceCategory[] = [
  "EMPLOYER_DISCLOSURE",
  "AGENCY_DISCLOSURE",
  "COUNTRY_RULE",
  "CORRIDOR_RULE",
  "MANDATORY_WARNING",
  "LEGAL_STATEMENT",
  "TRUST_ELEMENT",
  "FORBIDDEN_CLAIM",
];

/**
 * Whether a rule has been checked by a qualified reviewer.
 *
 * Seeded rules are REQUIRES_LEGAL_REVIEW without exception. This field
 * exists so the distinction between "encoded by an engineer from public
 * sources" and "confirmed by someone qualified to confirm it" is visible
 * to every consumer, instead of being lost the moment the rule is stored.
 */
export type ReviewStatus = "REQUIRES_LEGAL_REVIEW" | "REVIEWED";

export interface ComplianceRule {
  /** Stable, citable identifier. Never reused or renumbered. */
  id: string;
  category: ComplianceCategory;
  /** What the rule actually requires, in plain language. */
  requirement: string;
  /** The instrument or body it comes from. */
  authority: string;
  /** A precise reference where one is genuinely known; "general provision" otherwise. */
  citation: string;
  reviewStatus: ReviewStatus;
  /** Origin country this applies to, or null for any covered origin. */
  originCountry: string | null;
  /** Destination country this applies to, or null for any covered destination. */
  destinationCountry: string | null;
  /** Industries this is limited to, or null for all. */
  industries: string[] | null;
  /**
   * Why this rule exists, for the recruiter reading the determination.
   * Not legal argument — the practical consequence of ignoring it.
   */
  rationale: string;
}

// ---------------------------------------------------------------------------
// Declared coverage
// ---------------------------------------------------------------------------

/**
 * Origin countries this knowledge base speaks for.
 *
 * India only. The engine has no rules for any other sending country and
 * says so rather than applying India's to a corridor it does not govern.
 */
export const COVERED_ORIGINS = ["India"] as const;

/**
 * Destination countries this knowledge base speaks for.
 *
 * The six GCC states. A requirement for Malaysia, Romania or Japan gets
 * UNKNOWN for every country and corridor determination — those corridors
 * have genuinely different regimes and guessing across them is exactly
 * what this engine must not do.
 */
export const COVERED_DESTINATIONS = [
  "Saudi Arabia",
  "United Arab Emirates",
  "Qatar",
  "Kuwait",
  "Bahrain",
  "Oman",
] as const;

/**
 * The origin this engine assumes for an agency operating under an Indian
 * recruiting-agent licence. Stated explicitly rather than inferred, so
 * the assumption is visible and can be changed when the platform serves
 * agencies licensed elsewhere.
 */
export const DEFAULT_ORIGIN_COUNTRY = "India";

export const isCoveredOrigin = (country: string | null): boolean =>
  country !== null && (COVERED_ORIGINS as readonly string[]).includes(country);

export const isCoveredDestination = (country: string | null): boolean =>
  country !== null && (COVERED_DESTINATIONS as readonly string[]).includes(country);

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

const INDIA = "India";

/**
 * India-origin rules.
 *
 * The Emigration Act 1983 and the Emigration Rules made under it govern
 * recruitment of Indian nationals for overseas employment. The
 * requirements encoded here are the ones that bear directly on what an
 * advertisement must say and what an agency may not do.
 */
const INDIA_ORIGIN_RULES: ComplianceRule[] = [
  {
    id: "IN-EMIG-RA-NUMBER",
    category: "AGENCY_DISCLOSURE",
    requirement:
      "The recruiting agent's registration number issued by the Protector General of Emigrants must be displayed on the advertisement.",
    authority: "Emigration Act 1983 and the Emigration Rules made under it (India)",
    citation: "general provision — advertisement disclosure requirement for registered recruiting agents",
    reviewStatus: "REQUIRES_LEGAL_REVIEW",
    originCountry: INDIA,
    destinationCountry: null,
    industries: null,
    rationale:
      "The registration number is how a candidate confirms the agency is licensed at all. An advertisement without it is indistinguishable from one placed by an unlicensed operator.",
  },
  {
    id: "IN-EMIG-AGENCY-NAME",
    category: "AGENCY_DISCLOSURE",
    requirement: "The registered name of the recruiting agent must appear on the advertisement.",
    authority: "Emigration Act 1983 and the Emigration Rules made under it (India)",
    citation: "general provision — advertisement disclosure requirement for registered recruiting agents",
    reviewStatus: "REQUIRES_LEGAL_REVIEW",
    originCountry: INDIA,
    destinationCountry: null,
    industries: null,
    rationale:
      "A registration number that cannot be tied to a named agency cannot be checked against the register.",
  },
  {
    id: "IN-EMIG-NO-FEE-CLAIM",
    category: "FORBIDDEN_CLAIM",
    requirement:
      "The advertisement must not solicit or imply any payment from the candidate beyond charges the agency is lawfully permitted to levy.",
    authority: "Emigration Act 1983 and the Emigration Rules made under it (India)",
    citation: "general provision — restriction on charges recoverable from emigrants",
    reviewStatus: "REQUIRES_LEGAL_REVIEW",
    originCountry: INDIA,
    destinationCountry: null,
    industries: null,
    rationale:
      "Overcharging candidates is the single most common cause of licence action against recruiting agents, and an advertisement that invites it is written evidence.",
  },
  {
    id: "IN-EMIG-NO-GOVT-ENDORSEMENT",
    category: "FORBIDDEN_CLAIM",
    requirement:
      "The advertisement must not claim government approval, endorsement or certification, and must not reproduce official emblems or seals.",
    authority: "Emigration Act 1983 (India); State Emblem of India (Prohibition of Improper Use) Act 2005",
    citation: "general provision — prohibition on improper use of official emblems and false endorsement",
    reviewStatus: "REQUIRES_LEGAL_REVIEW",
    originCountry: INDIA,
    destinationCountry: null,
    industries: null,
    rationale:
      "Registration is not endorsement. Implying the government backs a specific vacancy is a misrepresentation to the candidate and an improper use of the emblem.",
  },
  {
    id: "IN-EMIG-ECR-AWARENESS",
    category: "MANDATORY_WARNING",
    requirement:
      "Candidates holding ECR-category passports must be informed that emigration clearance is required before departure for the notified destination.",
    authority: "Emigration Act 1983 (India); eMigrate system operated by the Ministry of External Affairs",
    citation: "general provision — emigration clearance requirement for ECR passport holders",
    reviewStatus: "REQUIRES_LEGAL_REVIEW",
    originCountry: INDIA,
    destinationCountry: null,
    industries: null,
    rationale:
      "A candidate who books travel without clearance is stopped at immigration, having already paid. The warning belongs on the advertisement, not in a later conversation.",
  },
  {
    id: "IN-EMIG-NO-GUARANTEE",
    category: "FORBIDDEN_CLAIM",
    requirement:
      "The advertisement must not guarantee a visa, selection, or employment outcome.",
    authority: "Emigration Act 1983 (India); general consumer-protection law",
    citation: "general provision — prohibition on misleading representations",
    reviewStatus: "REQUIRES_LEGAL_REVIEW",
    originCountry: INDIA,
    destinationCountry: null,
    industries: null,
    rationale:
      "No agency controls a destination state's visa decision. A guarantee is a promise the agency cannot keep and a candidate will rely on.",
  },
];

/**
 * Destination rules for the covered GCC states.
 *
 * The employer-pays principle and the prohibition on passport retention
 * are common to all six; each state's own labour authority is named on
 * the rule so a reviewer can verify against the right regulator.
 */
const GCC_LABOUR_AUTHORITY: Record<string, string> = {
  "Saudi Arabia": "Ministry of Human Resources and Social Development (Saudi Arabia)",
  "United Arab Emirates": "Ministry of Human Resources and Emiratisation (United Arab Emirates)",
  "Qatar": "Ministry of Labour (Qatar)",
  "Kuwait": "Public Authority of Manpower (Kuwait)",
  "Bahrain": "Labour Market Regulatory Authority (Bahrain)",
  "Oman": "Ministry of Labour (Oman)",
};

const DESTINATION_RULES: ComplianceRule[] = (COVERED_DESTINATIONS as readonly string[]).flatMap(
  (destination) => [
    {
      id: `GCC-${destination.replace(/\s+/g, "-").toUpperCase()}-EMPLOYER-PAYS`,
      category: "EMPLOYER_DISCLOSURE" as const,
      requirement:
        "Recruitment costs are borne by the employer. The advertisement must not represent that the candidate bears recruitment, visa or air-ticket costs.",
      authority: GCC_LABOUR_AUTHORITY[destination],
      citation: "general provision — employer responsibility for recruitment costs",
      reviewStatus: "REQUIRES_LEGAL_REVIEW" as const,
      originCountry: null,
      destinationCountry: destination,
      industries: null,
      rationale:
        "Charging the worker for costs the employer must bear is the definition of the debt bondage these regimes were reformed to eliminate.",
    },
    {
      id: `GCC-${destination.replace(/\s+/g, "-").toUpperCase()}-NO-PASSPORT-RETENTION`,
      category: "COUNTRY_RULE" as const,
      requirement:
        "The employer may not retain the worker's passport. The advertisement must not state or imply that passports will be held.",
      authority: GCC_LABOUR_AUTHORITY[destination],
      citation: "general provision — prohibition on retention of workers' identity documents",
      reviewStatus: "REQUIRES_LEGAL_REVIEW" as const,
      originCountry: null,
      destinationCountry: destination,
      industries: null,
      rationale:
        "Passport retention is unlawful across the GCC and is the control mechanism behind most forced-labour findings in the region.",
    },
    {
      id: `GCC-${destination.replace(/\s+/g, "-").toUpperCase()}-WRITTEN-CONTRACT`,
      category: "EMPLOYER_DISCLOSURE" as const,
      requirement:
        "Terms advertised — salary, hours, benefits and duration — must match the written employment contract the worker will sign.",
      authority: GCC_LABOUR_AUTHORITY[destination],
      citation: "general provision — requirement for a written employment contract on stated terms",
      reviewStatus: "REQUIRES_LEGAL_REVIEW" as const,
      originCountry: null,
      destinationCountry: destination,
      industries: null,
      rationale:
        "Contract substitution — advertising one salary and issuing another on arrival — is the complaint that most often reaches the Protector General.",
    },
  ],
);

/** Corridor rules: specific to an origin AND destination pair. */
const CORRIDOR_RULES: ComplianceRule[] = (COVERED_DESTINATIONS as readonly string[]).map(
  (destination) => ({
    id: `IN-${destination.replace(/\s+/g, "-").toUpperCase()}-EMIGRATE-REGISTRATION`,
    category: "CORRIDOR_RULE" as const,
    requirement:
      "The foreign employer and the demand must be registered on the eMigrate system before ECR-category candidates can be cleared for this destination.",
    authority: "Ministry of External Affairs (India) — eMigrate system",
    citation: "general provision — employer and demand registration for notified ECR destinations",
    reviewStatus: "REQUIRES_LEGAL_REVIEW" as const,
    originCountry: INDIA,
    destinationCountry: destination,
    industries: null,
    rationale:
      "Without eMigrate registration the clearance cannot issue, so every ECR candidate recruited against this demand is unable to travel regardless of selection.",
  }),
);

/** Trust elements the platform itself requires on any advertisement it produces. */
const TRUST_RULES: ComplianceRule[] = [
  {
    id: "KAI-TRUST-VERIFICATION-QR",
    category: "TRUST_ELEMENT",
    requirement:
      "A verification QR resolving to the KAI-controlled verification page must appear on the advertisement.",
    authority: "KAI Ads platform policy",
    citation: "Advertisement Composition Constitution — Unified Verification QR Badge",
    reviewStatus: "REVIEWED",
    originCountry: null,
    destinationCountry: null,
    industries: null,
    rationale:
      "It is the only element on the advertisement a candidate can check independently of whoever handed it to them.",
  },
  {
    id: "KAI-TRUST-AGENCY-VERIFIED",
    category: "TRUST_ELEMENT",
    requirement:
      "The agency's verification status must be current before an advertisement carrying the verification mark is published.",
    authority: "KAI Ads platform policy",
    citation: "Agency Verification workflow",
    reviewStatus: "REVIEWED",
    originCountry: null,
    destinationCountry: null,
    industries: null,
    rationale:
      "A verification mark on an unverified agency's advertisement is worse than no mark: it launders exactly the risk it is meant to signal.",
  },
];

/** Healthcare licensing, the one industry-scoped rule seeded here. */
const INDUSTRY_RULES: ComplianceRule[] = [
  {
    id: "GCC-HEALTHCARE-LICENSING",
    category: "MANDATORY_WARNING",
    requirement:
      "Healthcare roles require destination-state professional licensing. The advertisement must state that appointment is subject to licensing rather than implying it is automatic.",
    authority: "Destination-state health regulator",
    citation: "general provision — professional licensing requirement for healthcare practitioners",
    reviewStatus: "REQUIRES_LEGAL_REVIEW",
    originCountry: null,
    destinationCountry: null,
    industries: ["Healthcare"],
    rationale:
      "A nurse who mobilizes without passing the licensing examination cannot practise, and the placement fails after the candidate has already emigrated.",
  },
];

export const COMPLIANCE_RULES: ComplianceRule[] = [
  ...INDIA_ORIGIN_RULES,
  ...DESTINATION_RULES,
  ...CORRIDOR_RULES,
  ...TRUST_RULES,
  ...INDUSTRY_RULES,
];

/**
 * Legal statements the engine can require verbatim.
 *
 * Held as data so the exact wording is reviewable in one place rather
 * than assembled in code. The engine reports that a statement is
 * required and supplies the text; it does not place it anywhere, because
 * placing it is rendering and rendering belongs to a later stage.
 */
export const REQUIRED_LEGAL_STATEMENTS: {
  id: string;
  appliesWhenOrigin: string;
  text: string;
  authority: string;
  reviewStatus: ReviewStatus;
}[] = [
  {
    id: "IN-STMT-NO-FEE",
    appliesWhenOrigin: INDIA,
    text: "No charges are payable by candidates other than those permitted under the Emigration Rules.",
    authority: "Emigration Act 1983 and the Emigration Rules made under it (India)",
    reviewStatus: "REQUIRES_LEGAL_REVIEW",
  },
  {
    id: "IN-STMT-ECR-CLEARANCE",
    appliesWhenOrigin: INDIA,
    text: "Candidates holding ECR passports require emigration clearance before departure.",
    authority: "Ministry of External Affairs (India) — eMigrate system",
    reviewStatus: "REQUIRES_LEGAL_REVIEW",
  },
];

/**
 * Forbidden claim phrases.
 *
 * Sourced from the render-time scanner (prohibited-claims.service.ts)
 * rather than restated, so the requirement this engine determines and the
 * check that later enforces it can never disagree. Compliance-specific
 * phrases are added alongside — these describe promises about the
 * outcome of a recruitment, which the render-time list does not cover.
 */
export const COMPLIANCE_FORBIDDEN_PHRASES: string[] = [
  ...PROHIBITED_PHRASES,
  ...PROHIBITED_BRANDING_TERMS,
  "guaranteed visa",
  "visa guaranteed",
  "100% visa",
  "100% job",
  "job guaranteed",
  "guaranteed job",
  "guaranteed selection",
  "assured visa",
  "assured job",
  "direct visa",
  "free visa",
  "no interview",
  "instant visa",
];

export const findRule = (id: string): ComplianceRule | undefined =>
  COMPLIANCE_RULES.find((rule) => rule.id === id);

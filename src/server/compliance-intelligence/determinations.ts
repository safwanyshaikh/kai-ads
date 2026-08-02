import {
  COMPLIANCE_CATEGORIES,
  COMPLIANCE_FORBIDDEN_PHRASES,
  COMPLIANCE_RULES,
  COVERED_DESTINATIONS,
  COVERED_ORIGINS,
  DEFAULT_ORIGIN_COUNTRY,
  REQUIRED_LEGAL_STATEMENTS,
  isCoveredDestination,
  isCoveredOrigin,
  type ComplianceCategory,
  type ComplianceRule,
  type ReviewStatus,
} from "./knowledge-base";
import { UNKNOWN, type Unknown } from "@/server/job-order-intelligence/determinations";

/**
 * Compliance Intelligence — the determinations.
 *
 *   ... -> JobOrder Intelligence -> **Compliance Intelligence** -> ...
 *
 * Determines the recruitment compliance requirements that apply to one
 * requirement, before any campaign exists. It generates no
 * advertisement, selects no layout and renders nothing.
 *
 * THE CONTRACT
 *
 *   * Every determination carries Source, Confidence and Reason.
 *   * Every determination is deterministic — no model, no clock.
 *   * If a rule is not in the knowledge base, the answer is UNKNOWN.
 *
 * THE DISTINCTION THAT MATTERS MOST
 *
 * "No requirements apply" and "we have no rules for this corridor" are
 * opposite answers that look identical in a list. This engine never
 * conflates them: an uncovered corridor yields UNKNOWN with the coverage
 * gap named, never an empty result that reads as a clean bill.
 *
 * WHAT THIS ENGINE IS NOT
 *
 * It determines what compliance REQUIRES. It does not check an
 * advertisement against those requirements — no advertisement exists
 * yet. The render-time enforcement of the same rules already lives in
 * prohibited-claims.service.ts and trust-validation.service.ts, and this
 * engine deliberately cites the same phrase list rather than restating
 * it, so a requirement determined here and a check applied there can
 * never disagree.
 */

export type ComplianceStatus =
  /** The rule applies and the requirement is satisfied by what is on record. */
  | "SATISFIED"
  /** The rule applies and something is still needed. */
  | "REQUIRED"
  /** The rule applies and the record contradicts it. */
  | "VIOLATED"
  /** No rule of this kind exists in the knowledge base for this corridor. */
  | "NOT_IN_KNOWLEDGE_BASE";

export interface ComplianceDetermination {
  /** Rule id, or `category:summary` for a category-level verdict. */
  code: string;
  category: ComplianceCategory;
  /** The applicable requirement, or UNKNOWN when the knowledge base is silent. */
  value: string | Unknown;
  status: ComplianceStatus | Unknown;
  /** 0–100. Zero whenever the value is UNKNOWN. */
  confidencePct: number;
  /** Where the determination came from. */
  source: string;
  /** Plain-language explanation. Never empty. */
  reason: string;
  /** The legal instrument, or null for a coverage-gap determination. */
  authority: string | null;
  /** Precise reference where genuinely known; never fabricated. */
  citation: string | null;
  reviewStatus: ReviewStatus | null;
}

export interface ComplianceInput {
  /** Canonical JobOrder. */
  destinationCountry: string | null;
  /** Stated explicitly; defaults to the licence jurisdiction the agency operates under. */
  originCountry?: string | null;
  employerName: string | null;
  /** From JobOrder Intelligence — may be the literal "UNKNOWN". */
  industry: string | null;
  /** Agency record. */
  agency: {
    name: string | null;
    registrationNumber: string | null;
    verificationStatus: string | null;
  };
  /** Position salaries as recorded, to test the employer-pays and contract rules. */
  positionSalaries: (string | null)[];
  /** Text the requirement actually carried, scanned for forbidden claims. */
  requirementTexts: string[];
}

const CONFIDENCE = {
  /** A rule read directly out of the knowledge base and matched on corridor. */
  RULE_MATCH: 95,
  /** A record-based check — the value is on file or it is not. */
  RECORD_CHECK: 100,
  /** A forbidden phrase found verbatim in the requirement's own text. */
  PHRASE_MATCH: 98,
} as const;

function unknownFor(
  code: string,
  category: ComplianceCategory,
  reason: string,
): ComplianceDetermination {
  return {
    code,
    category,
    value: UNKNOWN,
    status: UNKNOWN,
    confidencePct: 0,
    source: "compliance knowledge base",
    reason,
    authority: null,
    citation: null,
    reviewStatus: null,
  };
}

/**
 * Resolves which rules the knowledge base holds for this corridor.
 *
 * COVERAGE IS PER-SCOPE, NOT ALL-OR-NOTHING.
 *
 * An origin-scoped rule binds on the origin alone. India's Emigration
 * Act governs an Indian recruiting agent whatever the destination, so
 * for an India-to-Malaysia requirement the RA-number disclosure still
 * applies and reporting it UNKNOWN would be wrong in the other
 * direction — it would tell an agency a real obligation might not exist.
 *
 * Destination- and corridor-scoped rules need the destination to be
 * covered, and go UNKNOWN when it is not. The two halves are assessed
 * independently precisely because they answer to different lawmakers.
 */
export function applicableRules(input: ComplianceInput): ComplianceRule[] {
  const origin = input.originCountry ?? DEFAULT_ORIGIN_COUNTRY;
  const destination = input.destinationCountry;

  return COMPLIANCE_RULES.filter((rule) => {
    if (rule.originCountry !== null && rule.originCountry !== origin) return false;
    if (rule.destinationCountry !== null && rule.destinationCountry !== destination) return false;
    if (rule.industries !== null) {
      if (input.industry === null || input.industry === UNKNOWN) return false;
      if (!rule.industries.includes(input.industry)) return false;
    }
    return true;
  }).sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Decides whether a rule the corridor imposes is already satisfied.
 *
 * Only checks that can be made from the record are made. A rule whose
 * satisfaction depends on something the platform does not hold — whether
 * the employer is registered on eMigrate, whether the written contract
 * matches — stays REQUIRED rather than being marked satisfied on
 * optimism. REQUIRED means "a human must confirm this", which is the
 * honest state.
 */
function evaluateRule(rule: ComplianceRule, input: ComplianceInput): {
  status: ComplianceStatus;
  reason: string;
  source: string;
} {
  switch (rule.id) {
    case "IN-EMIG-RA-NUMBER": {
      const present = Boolean(input.agency.registrationNumber?.trim());
      return {
        status: present ? "SATISFIED" : "REQUIRED",
        source: "agency record",
        reason: present
          ? `The agency's registration number is on file (${input.agency.registrationNumber}) and can be printed on the advertisement.`
          : "The agency has no registration number on file, so this disclosure cannot be made.",
      };
    }

    case "IN-EMIG-AGENCY-NAME": {
      const present = Boolean(input.agency.name?.trim());
      return {
        status: present ? "SATISFIED" : "REQUIRED",
        source: "agency record",
        reason: present
          ? `The agency's registered name is on file (${input.agency.name}).`
          : "The agency has no registered name on file, so this disclosure cannot be made.",
      };
    }

    case "KAI-TRUST-AGENCY-VERIFIED": {
      const verified = input.agency.verificationStatus === "VERIFIED";
      return {
        status: verified ? "SATISFIED" : "REQUIRED",
        source: "agency verification record",
        reason: verified
          ? "The agency's verification is current."
          : `The agency's verification status is ${input.agency.verificationStatus ?? "not recorded"}, so the verification mark must not be used yet.`,
      };
    }

    default:
      return {
        status: "REQUIRED",
        source: "compliance knowledge base",
        reason: `${rule.requirement} ${rule.rationale}`,
      };
  }
}

/**
 * Determines every applicable requirement, plus a verdict for each
 * category the knowledge base is silent on.
 *
 * A category with no matching rule produces an explicit
 * NOT_IN_KNOWLEDGE_BASE or UNKNOWN row rather than nothing at all, so a
 * consumer reading the result can never mistake silence for clearance.
 */
export function determineRequirements(input: ComplianceInput): ComplianceDetermination[] {
  const origin = input.originCountry ?? DEFAULT_ORIGIN_COUNTRY;
  const destination = input.destinationCountry;
  const determinations: ComplianceDetermination[] = [];

  const originCovered = isCoveredOrigin(origin);
  const destinationCovered = isCoveredDestination(destination);

  const rules = originCovered || destinationCovered ? applicableRules(input) : [];

  for (const rule of rules) {
    const evaluated = evaluateRule(rule, input);
    determinations.push({
      code: rule.id,
      category: rule.category,
      value: rule.requirement,
      status: evaluated.status,
      confidencePct: evaluated.source === "compliance knowledge base" ? CONFIDENCE.RULE_MATCH : CONFIDENCE.RECORD_CHECK,
      source: evaluated.source,
      reason: `${evaluated.reason} Source: ${rule.authority} (${rule.citation}).`,
      authority: rule.authority,
      citation: rule.citation,
      reviewStatus: rule.reviewStatus,
    });
  }

  // Coverage gaps, stated per category rather than left as absence.
  for (const category of COMPLIANCE_CATEGORIES) {
    if (determinations.some((determination) => determination.category === category)) continue;

    if (!destinationCovered) {
      determinations.push(
        unknownFor(
          `${category}:summary`,
          category,
          `The compliance knowledge base holds no ${category.toLowerCase().replace(/_/g, " ")} rules for ${destination ?? "an unstated destination"}. Covered destinations are: ${COVERED_DESTINATIONS.join(", ")}. Reported as UNKNOWN — this is NOT a finding that no requirements apply.`,
        ),
      );
      continue;
    }

    if (!originCovered) {
      determinations.push(
        unknownFor(
          `${category}:summary`,
          category,
          `The compliance knowledge base holds no ${category.toLowerCase().replace(/_/g, " ")} rules for recruitment from ${origin}. Covered origins are: ${COVERED_ORIGINS.join(", ")}. Reported as UNKNOWN — this is NOT a finding that no requirements apply.`,
        ),
      );
      continue;
    }

    determinations.push({
      code: `${category}:summary`,
      category,
      value: "No rule of this kind in the knowledge base for this corridor",
      status: "NOT_IN_KNOWLEDGE_BASE",
      confidencePct: CONFIDENCE.RULE_MATCH,
      source: "compliance knowledge base",
      reason: `The corridor ${origin} to ${destination} is covered by the knowledge base, and it holds no ${category.toLowerCase().replace(/_/g, " ")} rules for it. This states the knowledge base's contents, not that the law imposes nothing.`,
      authority: null,
      citation: null,
      reviewStatus: null,
    });
  }

  return determinations.sort((a, b) => a.category.localeCompare(b.category) || a.code.localeCompare(b.code));
}

/**
 * Required legal statements for the corridor, with their exact wording.
 *
 * The engine reports that a statement is required and supplies the text.
 * It does not place it anywhere — placement is rendering, and rendering
 * belongs to a later stage.
 */
export function determineLegalStatements(input: ComplianceInput): ComplianceDetermination[] {
  const origin = input.originCountry ?? DEFAULT_ORIGIN_COUNTRY;

  if (!isCoveredOrigin(origin)) {
    return [
      unknownFor(
        "LEGAL_STATEMENT:summary",
        "LEGAL_STATEMENT",
        `The compliance knowledge base holds no required legal statements for recruitment from ${origin}. Covered origins are: ${COVERED_ORIGINS.join(", ")}. Reported as UNKNOWN — this is NOT a finding that no statement is required.`,
      ),
    ];
  }

  return REQUIRED_LEGAL_STATEMENTS.filter((statement) => statement.appliesWhenOrigin === origin).map(
    (statement) => ({
      code: statement.id,
      category: "LEGAL_STATEMENT" as const,
      value: statement.text,
      status: "REQUIRED" as const,
      confidencePct: CONFIDENCE.RULE_MATCH,
      source: "compliance knowledge base",
      reason: `This statement is required verbatim for ${origin}-origin recruitment. Source: ${statement.authority}. The engine supplies the wording only; where it appears is decided when the advertisement is produced.`,
      authority: statement.authority,
      citation: "required statement text",
      reviewStatus: statement.reviewStatus,
    }),
  );
}

/**
 * Forbidden claims, checked against the requirement's own text.
 *
 * Two things are reported: the phrases forbidden for this corridor, and
 * any that ALREADY appear in what the employer or agent sent. The second
 * matters — a demand letter promising "free visa" will otherwise be
 * copied into an advertisement in good faith.
 */
export function determineForbiddenClaims(input: ComplianceInput): ComplianceDetermination[] {
  const haystack = input.requirementTexts.join(" \n ").toLowerCase();

  const found = COMPLIANCE_FORBIDDEN_PHRASES.filter((phrase) => haystack.includes(phrase)).sort();

  if (found.length === 0) {
    return [
      {
        code: "FORBIDDEN_CLAIM:scan",
        category: "FORBIDDEN_CLAIM",
        value: "No forbidden claim found in the requirement as received",
        status: "SATISFIED",
        confidencePct: CONFIDENCE.PHRASE_MATCH,
        source: "requirement text",
        reason: `The requirement's own text was scanned against ${COMPLIANCE_FORBIDDEN_PHRASES.length} forbidden phrases and none appeared. This covers the text as received; the advertisement itself is checked again when it is produced.`,
        authority: "KAI Ads platform policy; Emigration Act 1983 (India)",
        citation: "prohibited-claims phrase list",
        reviewStatus: "REQUIRES_LEGAL_REVIEW",
      },
    ];
  }

  return found.map((phrase) => ({
    code: `FORBIDDEN_CLAIM:${phrase.replace(/\s+/g, "-")}`,
    category: "FORBIDDEN_CLAIM" as const,
    value: `Forbidden claim present in the requirement: "${phrase}"`,
    status: "VIOLATED" as const,
    confidencePct: CONFIDENCE.PHRASE_MATCH,
    source: "requirement text",
    reason: `The phrase "${phrase}" appears in the requirement as received. It must not be carried into an advertisement, and the sender should be asked to withdraw it — a claim copied in good faith from a demand letter is still the agency's claim once it is published.`,
    authority: "KAI Ads platform policy; Emigration Act 1983 (India)",
    citation: "prohibited-claims phrase list",
    reviewStatus: "REQUIRES_LEGAL_REVIEW" as const,
  }));
}

/**
 * Compliance information the platform does not hold and cannot proceed
 * confidently without.
 *
 * Distinct from a rule: these are gaps in the record, not requirements
 * of law. Each names what is missing and what it blocks.
 */
export function determineMissingInformation(input: ComplianceInput): ComplianceDetermination[] {
  const missing: ComplianceDetermination[] = [];

  const record = (code: string, what: string, blocks: string) =>
    missing.push({
      code: `MISSING:${code}`,
      category: "AGENCY_DISCLOSURE",
      value: what,
      status: "REQUIRED",
      confidencePct: CONFIDENCE.RECORD_CHECK,
      source: "requirement and agency records",
      reason: `${what} ${blocks}`,
      authority: null,
      citation: null,
      reviewStatus: null,
    });

  if (!input.destinationCountry) {
    record(
      "DESTINATION",
      "The requirement has no destination country.",
      "No country or corridor rule can be resolved without it — this is what makes the whole compliance assessment UNKNOWN.",
    );
  }

  if (!input.agency.registrationNumber?.trim()) {
    record(
      "RA-NUMBER",
      "The agency has no recruiting-agent registration number on file.",
      "It is a mandatory advertisement disclosure, so no compliant advertisement can be produced until it is recorded.",
    );
  }

  if (!input.employerName?.trim()) {
    record(
      "EMPLOYER",
      "No employer is linked to this requirement.",
      "Employer-side disclosures and eMigrate registration cannot be confirmed against an unnamed principal.",
    );
  }

  if (input.positionSalaries.length > 0 && input.positionSalaries.every((salary) => salary === null)) {
    record(
      "SALARY",
      "No position states a salary.",
      "The advertised terms must match the written contract, which cannot be checked when no terms were stated.",
    );
  }

  return missing.sort((a, b) => a.code.localeCompare(b.code));
}

export type ComplianceReadiness =
  /** Every applicable requirement is satisfied or is a known outstanding action. */
  | "READY"
  /** Something on the record contradicts a requirement. */
  | "BLOCKED"
  /** Requirements are known and outstanding actions remain. */
  | "ACTION_REQUIRED"
  /** The corridor is not covered — readiness cannot be assessed at all. */
  | "UNKNOWN";

export interface ComplianceAssessment {
  determinations: ComplianceDetermination[];
  readiness: ComplianceDetermination;
  /** True when any seeded rule in play still awaits legal review. */
  requiresLegalReview: boolean;
}

/**
 * Runs the whole assessment.
 *
 * Readiness is deliberately conservative. A violated rule BLOCKS. An
 * uncovered corridor is UNKNOWN, never READY — the engine will not
 * certify a corridor it has no rules for, because "READY" would be read
 * as "checked and clear".
 */
export function assessCompliance(input: ComplianceInput): ComplianceAssessment {
  const determinations = [
    ...determineRequirements(input),
    ...determineLegalStatements(input),
    ...determineForbiddenClaims(input),
    ...determineMissingInformation(input),
  ];

  // Legal statements are produced separately, so drop the placeholder the
  // category sweep emitted for them when real statements exist.
  const hasRealStatements = determinations.some(
    (determination) => determination.category === "LEGAL_STATEMENT" && determination.code !== "LEGAL_STATEMENT:summary",
  );
  const deduped = hasRealStatements
    ? determinations.filter((determination) => determination.code !== "LEGAL_STATEMENT:summary")
    : determinations;

  const unique = new Map<string, ComplianceDetermination>();
  for (const determination of deduped) unique.set(determination.code, determination);
  const all = [...unique.values()].sort(
    (a, b) => a.category.localeCompare(b.category) || a.code.localeCompare(b.code),
  );

  const destinationCovered = isCoveredDestination(input.destinationCountry);
  const originCovered = isCoveredOrigin(input.originCountry ?? DEFAULT_ORIGIN_COUNTRY);

  const violated = all.filter((determination) => determination.status === "VIOLATED");
  const outstanding = all.filter((determination) => determination.status === "REQUIRED");

  let readiness: ComplianceDetermination;

  if (!destinationCovered || !originCovered) {
    readiness = {
      code: "COMPLIANCE_READINESS",
      category: "COUNTRY_RULE",
      value: UNKNOWN,
      status: UNKNOWN,
      confidencePct: 0,
      source: "compliance knowledge base",
      reason: `Readiness cannot be assessed: the knowledge base does not cover ${!destinationCovered ? `the destination "${input.destinationCountry ?? "not stated"}"` : `the origin "${input.originCountry ?? DEFAULT_ORIGIN_COUNTRY}"`}. Reported as UNKNOWN rather than READY — an unassessed corridor must never read as a cleared one.`,
      authority: null,
      citation: null,
      reviewStatus: null,
    };
  } else if (violated.length > 0) {
    readiness = {
      code: "COMPLIANCE_READINESS",
      category: "COUNTRY_RULE",
      value: "BLOCKED",
      status: "VIOLATED",
      confidencePct: CONFIDENCE.RECORD_CHECK,
      source: "compliance assessment",
      reason: `${violated.length} requirement${violated.length === 1 ? " is" : "s are"} contradicted by the requirement as received: ${violated.map((determination) => determination.code).join(", ")}. These must be resolved before any campaign is created.`,
      authority: null,
      citation: null,
      reviewStatus: null,
    };
  } else if (outstanding.length > 0) {
    readiness = {
      code: "COMPLIANCE_READINESS",
      category: "COUNTRY_RULE",
      value: "ACTION_REQUIRED",
      status: "REQUIRED",
      confidencePct: CONFIDENCE.RECORD_CHECK,
      source: "compliance assessment",
      reason: `The corridor is covered and ${outstanding.length} requirement${outstanding.length === 1 ? " remains" : "s remain"} outstanding. Each names what is needed and why.`,
      authority: null,
      citation: null,
      reviewStatus: null,
    };
  } else {
    readiness = {
      code: "COMPLIANCE_READINESS",
      category: "COUNTRY_RULE",
      value: "READY",
      status: "SATISFIED",
      confidencePct: CONFIDENCE.RECORD_CHECK,
      source: "compliance assessment",
      reason:
        "Every requirement the knowledge base holds for this corridor is satisfied by the record. This states compliance with the encoded rules only, and does not substitute for legal advice.",
      authority: null,
      citation: null,
      reviewStatus: null,
    };
  }

  return {
    determinations: [...all, readiness],
    readiness,
    requiresLegalReview: all.some((determination) => determination.reviewStatus === "REQUIRES_LEGAL_REVIEW"),
  };
}

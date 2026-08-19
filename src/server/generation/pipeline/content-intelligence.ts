import type { AdvertisementFacts } from "./types";
import { classifyRoleFamily } from "@/lib/role-families";
import { LayoutCapacityError } from "./fact-layer";

/**
 * KAI Recruitment DTP Intelligence — Requirement Intelligence stage.
 *
 * Reverse-engineered from the real Manpower_Vacant_Position2.pdf source and
 * two finished reference advertisements (see the DTP Intelligence
 * Reverse-Engineering analysis, Outputs A-E, and the self-challenge on
 * content compression vs. visual preservation). This module is the
 * Requirement Intelligence stage only: it classifies and clusters verified
 * facts and estimates whether the requirement is renderable. It draws
 * nothing — the one Rendering Engine (fact-layer.ts / branding-overlay.ts)
 * is untouched, and the Factual Integrity Law binds this module exactly as
 * it binds the renderer: no verified fact may be summarized away or
 * silently dropped, only deduplicated when genuinely repeated.
 */

/* -------------------------------------------------------------------------- */
/* STATEMENT TAXONOMY                                                         */
/* -------------------------------------------------------------------------- */

export type StatementTag =
  | "FUNCTIONAL"
  | "QUALIFICATION"
  | "EXPERIENCE"
  | "CERTIFICATION"
  | "ELIGIBILITY"
  | "GENERIC";

/**
 * ELIGIBILITY and CERTIFICATION statements are never compression-eligible,
 * regardless of how many positions repeat similar language — see
 * `isCompressionEligible`. This is what stops a rare, load-bearing nuance
 * (the PQCS "Saudi Aramco approval is preferred but not mandatory" case)
 * from being folded into a common-JD box, or silently dropped because it
 * looks like the odd one out.
 */
const NEVER_COMPRESS: ReadonlySet<StatementTag> = new Set(["ELIGIBILITY", "CERTIFICATION"]);

/**
 * Deterministic, auditable statement classifier. No LLM call — this stage
 * runs on verified extraction fields only, so its output must be
 * reproducible and explainable, not a fresh model judgement every run.
 */
export function tagStatement(text: string): StatementTag {
  const t = text.toLowerCase();

  // "preferred but not mandatory", "not mandatory but preferred", "preferred,
  // not essential" — the exact nuance the reference ads silently dropped.
  if (/preferred\s+but\s+not\s+mandatory|not\s+mandatory\s+but\s+preferred|preferred[, ]+not\s+essential|preferred\s+but\s+not\s+essential/.test(t)) {
    return "ELIGIBILITY";
  }

  if (/\b(nmr|certificat|licen[cs]e|ticket|welding\s+test|nebosh|iosh|api\s?\d|asme|aws\s?d)/.test(t)) {
    return "CERTIFICATION";
  }

  if (/\b(\d+\s*(?:\+|to|-)?\s*\d*\s*years?|yrs?)\b/.test(t)) {
    return "EXPERIENCE";
  }

  if (/\b(diploma|degree|bachelor|graduate|iti|b\.?tech|b\.?e\.?|qualification|educat)/.test(t)) {
    return "QUALIFICATION";
  }

  if (/\b(responsible for|shall|duties|supervis|coordinat|manage|plan and|maintain|inspect|operate)/.test(t)) {
    return "FUNCTIONAL";
  }

  return "GENERIC";
}

export interface PositionStatement {
  text: string;
  tag: StatementTag;
  /** Derived, never authored — see `isCompressionEligible`. */
  compressionEligible: boolean;
}

/**
 * Compression is deduplication of IDENTICAL or near-identical shared
 * language, never summarization. Eligible only for GENERIC and shared
 * FUNCTIONAL / QUALIFICATION / EXPERIENCE statements that recur across two
 * or more positions in the same role family. ELIGIBILITY and CERTIFICATION
 * statements are never eligible, no matter how many positions repeat
 * similar wording, because a nuance like "preferred but not mandatory" is
 * rare precisely because it is position-specific, not because it is
 * unimportant — see the self-challenge Case 2.
 */
export function isCompressionEligible(
  tag: StatementTag,
  text: string,
  siblingTexts: string[],
): boolean {
  if (NEVER_COMPRESS.has(tag)) return false;
  const norm = normalizeStatement(text);
  const matches = siblingTexts.filter((s) => normalizeStatement(s) === norm).length;
  return matches >= 2;
}

function normalizeStatement(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ").replace(/[.,;]+$/, "");
}

/* -------------------------------------------------------------------------- */
/* SOURCE RECORD                                                              */
/* -------------------------------------------------------------------------- */

/**
 * The Requirement Intelligence stage's input shape. Deliberately richer
 * than `AdvertisementFacts["positions"]` — it carries a free-text
 * `remarks` field because the raw source's Remark column (where PQCS's
 * "preferred but not mandatory" and the NMR ticket numbers actually live)
 * has no home in the extraction schema yet (see docs/011 gap analysis,
 * Output E). Capturing it here does not change the renderer or the
 * extraction API contract; it only lets this module classify statements
 * from the real source instead of only from what fact-layer currently
 * consumes.
 */
export interface PositionSourceRecord {
  title: string;
  count?: number;
  experience?: string | null;
  qualification?: string | null;
  certifications?: string[];
  remarks?: string | null;
  sourceRowIndex?: number;
}

export interface CampaignPosition extends PositionSourceRecord {
  statements: PositionStatement[];
}

export interface RoleFamily {
  id: string;
  label: string;
  positionTitles: string[];
  /**
   * Indexes into RecruitmentCampaign.positions. Index-based rather than
   * title-based because two positions can legitimately share a title;
   * the carousel slide plan's "every role maps to exactly one slide"
   * guarantee has to be provable, and titles cannot prove it.
   */
  positionIndexes: number[];
  /** Statements folded into the shared box, with the basis recorded for auditability. */
  commonRequirement: PositionStatement[];
  clusteringBasis: string;
}

export interface VacancySummary {
  totalPositions: number;
  totalVacancies: number;
  /** Always recomputed from positions, never cached/trusted from upstream input. */
  computedFromPositions: true;
}

export interface RecruitmentCampaign {
  positions: CampaignPosition[];
  roleFamilies: RoleFamily[];
  vacancySummary: VacancySummary;
}

/* -------------------------------------------------------------------------- */
/* ROLE-FAMILY CLUSTERING                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Clustering rules come from the ONE shared registry in
 * src/lib/role-families.ts (Final Production Lock §23) — the renderer
 * classifies with exactly the same rules, so a family can never mean
 * two different things in two places.
 */

/* -------------------------------------------------------------------------- */
/* CAMPAIGN CONSTRUCTION                                                      */
/* -------------------------------------------------------------------------- */

function statementsFor(p: PositionSourceRecord): PositionStatement[] {
  const raw: string[] = [];
  if (p.qualification) raw.push(p.qualification);
  if (p.experience) raw.push(p.experience);
  for (const c of p.certifications ?? []) raw.push(c);
  if (p.remarks) {
    // Split on sentence-ish separators so "Candidate hold Saudi Aramco
    // approval is preferred but not mandatory. Candidate familiar with NMR
    // 601,602,603 etc." tags as two statements, not one blended GENERIC one.
    for (const part of p.remarks.split(/(?<=[.;])\s+|\n+/)) {
      const trimmed = part.trim();
      if (trimmed) raw.push(trimmed);
    }
  }
  return raw.map((text) => ({ text, tag: tagStatement(text), compressionEligible: false }));
}

/**
 * Builds the Content Intelligence Model from verified source records:
 * tags every statement, clusters positions into role families, folds
 * genuinely repeated GENERIC/FUNCTIONAL/QUALIFICATION/EXPERIENCE language
 * into each family's common-requirement box, and recomputes the vacancy
 * total from the positions themselves (never trusts a cached total).
 */
export function buildRecruitmentCampaign(records: PositionSourceRecord[]): RecruitmentCampaign {
  const positions: CampaignPosition[] = records.map((r) => ({ ...r, statements: statementsFor(r) }));

  const familyOf = new Map<
    string,
    { id: string; label: string; basis: string; members: CampaignPosition[]; indexes: number[] }
  >();
  positions.forEach((p, index) => {
    const f = classifyRoleFamily(p.title);
    const bucket = familyOf.get(f.id) ?? { id: f.id, label: f.label, basis: f.basis, members: [], indexes: [] };
    bucket.members.push(p);
    bucket.indexes.push(index);
    familyOf.set(f.id, bucket);
  });

  const roleFamilies: RoleFamily[] = [];
  for (const bucket of familyOf.values()) {
    const allTexts = bucket.members.flatMap((m) => m.statements.map((s) => s.text));
    const commonSeen = new Set<string>();
    const commonRequirement: PositionStatement[] = [];

    for (const member of bucket.members) {
      for (const stmt of member.statements) {
        const eligible = isCompressionEligible(stmt.tag, stmt.text, allTexts);
        stmt.compressionEligible = eligible;
        if (eligible) {
          const norm = normalizeStatement(stmt.text);
          if (!commonSeen.has(norm)) {
            commonSeen.add(norm);
            commonRequirement.push(stmt);
          }
        }
      }
    }

    roleFamilies.push({
      id: bucket.id,
      label: bucket.label,
      positionTitles: bucket.members.map((m) => m.title),
      positionIndexes: [...bucket.indexes],
      commonRequirement,
      clusteringBasis: bucket.basis,
    });
  }

  const totalVacancies = positions.reduce((sum, p) => sum + (p.count ?? 0), 0);

  return {
    positions,
    roleFamilies,
    vacancySummary: {
      totalPositions: positions.length,
      totalVacancies,
      computedFromPositions: true,
    },
  };
}

/**
 * Statement volume after legal compression: every unique statement counts
 * once, plus one occurrence per position for each statement that could NOT
 * be compressed (not eligible, or the only member of its family carrying
 * it). This is deliberately a count of DISTINCT renderable facts, not text
 * length — the two-sided budget check in `decideDtpPlan` operates on this
 * number precisely because it can shrink through legal dedup but can never
 * shrink through information loss.
 */
export function compressedStatementCount(campaign: RecruitmentCampaign): number {
  const familyByTitle = new Map<string, RoleFamily>();
  for (const family of campaign.roleFamilies) {
    for (const title of family.positionTitles) familyByTitle.set(title, family);
  }

  // Shared statements are counted ONCE PER FAMILY (the common box renders
  // it a single time for every sibling that carries it) — the dedup set
  // must therefore span the whole family, not reset per position.
  const countedCommonByFamily = new Map<string, Set<string>>();
  let count = 0;

  for (const p of campaign.positions) {
    const family = familyByTitle.get(p.title);
    const familyCommonNorm = new Set((family?.commonRequirement ?? []).map((s) => normalizeStatement(s.text)));
    const familyCounted = family ? (countedCommonByFamily.get(family.id) ?? new Set<string>()) : new Set<string>();
    if (family) countedCommonByFamily.set(family.id, familyCounted);

    for (const stmt of p.statements) {
      const norm = normalizeStatement(stmt.text);
      if (stmt.compressionEligible && familyCommonNorm.has(norm)) {
        if (!familyCounted.has(norm)) {
          familyCounted.add(norm);
          count += 1; // the family box renders it once, shared by the family
        }
        continue;
      }
      count += 1; // position-level statement, always rendered per position
    }
  }
  return count;
}

export function rawStatementCount(campaign: RecruitmentCampaign): number {
  return campaign.positions.reduce((sum, p) => sum + p.statements.length, 0);
}

/* -------------------------------------------------------------------------- */
/* DTP DECISION ENGINE — hero reservation + two-sided capacity check          */
/* -------------------------------------------------------------------------- */

export type WidthTierId = "6xN" | "8xN" | "10xN" | "12xN";

/**
 * Hero Reservation Invariant (self-challenge revision): the hero/photo area
 * claims a FIXED proportion of canvas height before body content is ever
 * measured, and body growth (taller canvas, see fact-layer's own
 * `MAX_ASPECT`-bounded height solve) never encroaches on it. This is the
 * mechanism that makes "commercially useful hero area" a structural
 * guarantee rather than whatever body content happens to leave behind.
 * These figures document the invariant this module enforces; fact-layer's
 * existing `heroFrac`/`heroCap` machinery already implements the sparse
 * end of this table (see `heroFractionSparse`, `heroCapSparse` in the
 * Design DNA) — this table is this module's own audit trail, not a second
 * source of truth for the renderer's geometry.
 */
export const HERO_RESERVATION_PCT: Record<WidthTierId, number> = {
  "6xN": 0.3,
  "8xN": 0.32,
  "10xN": 0.35,
  "12xN": 0.38,
};

export function widthTierFor(widthPx: number): WidthTierId {
  if (widthPx <= 700) return "6xN";
  if (widthPx <= 900) return "8xN";
  if (widthPx <= 1100) return "10xN";
  return "12xN";
}

export interface DtpCapacityCheck {
  widthTier: WidthTierId;
  heroReservationPct: number;
  rawStatements: number;
  compressedStatements: number;
  /** Rough worst-case rows needed at the KDL legibility floor. */
  estimatedRows: number;
  /** Rows the widest permitted canvas (fact-layer's own MAX_ASPECT bound) can hold. */
  estimatedRowBudget: number;
  withinBudget: boolean;
}

/**
 * Advisory, fail-fast capacity estimate — NOT a second capacity law. The
 * authoritative check remains fact-layer's existing `MAX_ASPECT` bound
 * (`H > W * MAX_ASPECT` throws `LayoutCapacityError`); this function
 * estimates the same thing earlier, from the Content Intelligence Model,
 * so a genuinely unrenderable requirement (self-challenge Case 3 — dozens
 * of near-disjoint positions) fails BEFORE a Gemini call is spent, not
 * after. Reusing the renderer's own invariant, rather than inventing a
 * parallel one, is what keeps this "no new architecture."
 */
export function assessDtpCapacity(
  campaign: RecruitmentCampaign,
  widthPx: number,
  maxAspect = 4.0,
): DtpCapacityCheck {
  const widthTier = widthTierFor(widthPx);
  const heroReservationPct = HERO_RESERVATION_PCT[widthTier];
  const raw = rawStatementCount(campaign);
  const compressed = compressedStatementCount(campaign);

  // Conservative per-statement row estimate at the KDL legibility floor
  // (0.016 * W tall text plus its own line gap) — deliberately generous so
  // this pre-check never rejects something fact-layer's real solve could
  // still fit; it only catches genuinely hopeless cases early.
  const rowsPerStatement = 1.6;
  const estimatedRows = Math.ceil(compressed * rowsPerStatement) + campaign.positions.length; // one title row per position
  const bodyBudgetFraction = 1 - heroReservationPct;
  const maxBodyHeight = widthPx * maxAspect * bodyBudgetFraction;
  const rowHeight = widthPx * 0.03; // ~ KDL row pitch at floor size
  const estimatedRowBudget = Math.floor(maxBodyHeight / rowHeight);

  return {
    widthTier,
    heroReservationPct,
    rawStatements: raw,
    compressedStatements: compressed,
    estimatedRows,
    estimatedRowBudget,
    withinBudget: estimatedRows <= estimatedRowBudget,
  };
}

/**
 * Pre-flight capacity guard for the generation pipeline (see generate.ts).
 * Throws the SAME `LayoutCapacityError` fact-layer itself throws when a
 * requirement cannot be held at minimum readability, with a
 * `content-exceeds-max-tier` reason — one error type, one meaning, whether
 * it is raised here (before a Gemini call is spent) or inside fact-layer's
 * own height solve (after).
 */
export function enforceDtpCapacity(campaign: RecruitmentCampaign, widthPx: number): DtpCapacityCheck {
  const check = assessDtpCapacity(campaign, widthPx);
  if (!check.withinBudget) {
    throw new LayoutCapacityError(
      [
        `${campaign.vacancySummary.totalPositions} positions (${check.compressedStatements} distinct facts after ` +
          `legal deduplication) need an estimated ${check.estimatedRows} rows; the ${check.widthTier} canvas holds ` +
          `at most ${check.estimatedRowBudget} at minimum readability with its hero reservation intact.`,
      ],
      "content-exceeds-max-tier",
    );
  }
  return check;
}

/* -------------------------------------------------------------------------- */
/* ADVERTISEMENTFACTS BRIDGE                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Adapts the pipeline's existing `AdvertisementFacts` into
 * `PositionSourceRecord[]`. `remarks` has no home in `AdvertisementFacts`
 * yet (see the module doc on `PositionSourceRecord`), so positions built
 * this way carry no ELIGIBILITY statements — callers with richer source
 * data (e.g. the real-source fixture in tests) should build
 * `PositionSourceRecord[]` directly instead of going through this bridge.
 */
export function campaignFromAdvertisementFacts(facts: AdvertisementFacts): RecruitmentCampaign {
  const records: PositionSourceRecord[] = facts.positions.map((p) => ({
    title: p.title,
    count: p.count,
    experience: p.experience,
    qualification: p.qualification,
    certifications: p.certifications,
  }));
  return buildRecruitmentCampaign(records);
}


/* -------------------------------------------------------------------------- */
/* PRESENTATION COMPRESSION (§6 JD COMPRESSION LAW)                           */
/* -------------------------------------------------------------------------- */

/**
 * Shortens how a requirement is WORDED without changing what it says.
 *
 * §6 permits rewriting a long sentence into a shorter equivalent
 * ("minimum of 5 years of relevant experience" -> "5+ yrs relevant
 * experience") provided the underlying fact is identical. Every rule
 * below is a pure abbreviation of a word or a numeric range — no rule
 * removes a condition, a qualifier, a number, or a distinction.
 *
 * Deliberately NOT applied to certifications, eligibility statements,
 * registration numbers, dates, venues or vacancy counts: those are
 * matched by NEVER_COMPRESS / handled elsewhere and must survive
 * verbatim. This only ever touches the qualification/experience detail
 * line, and it is applied inside the ONE place both the planner and the
 * renderer read that line from (roleDetail in fact-layer.ts), so the two
 * can never disagree about the string's width.
 */
const PRESENTATION_RULES: Array<[RegExp, string]> = [
  // "minimum of 5 years" / "minimum 5 years" -> "5+ yrs"
  [/\bminimum\s+(?:of\s+)?(\d+)\s*(?:\+\s*)?years?\b/gi, "$1+ yrs"],
  // "5 to 8 years" / "5-8 years" -> "5-8 yrs"
  [/\b(\d+)\s*(?:to|-|–)\s*(\d+)\s*years?\b/gi, "$1-$2 yrs"],
  // "10 years" -> "10 yrs"; "10+ years" -> "10+ yrs"
  [/\b(\d+\s*\+?)\s*years?\b/gi, "$1 yrs"],
  // Common qualification wording.
  [/\bBachelor'?s\s+degree\s+in\b/gi, "Bachelor's in"],
  [/\bMaster'?s\s+degree\s+in\b/gi, "Master's in"],
  [/\bEngineering\b/g, "Engg."],
  [/\brelevant\s+experience\b/gi, "relevant exp."],
  [/\bexperience\b/gi, "exp."],
  // Collapse whitespace the substitutions may leave behind.
  [/\s{2,}/g, " "],
];

export function compressPresentation(text: string): string {
  let out = text;
  for (const [pattern, replacement] of PRESENTATION_RULES) {
    out = out.replace(pattern, replacement);
  }
  return out.trim();
}

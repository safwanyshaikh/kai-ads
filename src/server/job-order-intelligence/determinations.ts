import {
  INDUSTRY_SIGNALS,
  LANGUAGE_SIGNALS,
  PLANT_STATUS_SIGNALS,
  PLANT_TYPE_SIGNALS,
  RECRUITMENT_PATTERN_SIGNALS,
  SCARCE_CERTIFICATIONS,
  SECTOR_OF,
  TRADE_CATEGORY_SIGNALS,
  TRADE_SCARCITY,
  URGENCY_SIGNALS,
  type Industry,
  type TradeCategory,
} from "./taxonomy";
import {
  CONFIDENCE_THRESHOLD,
  confidenceFor,
  findSignals,
  scoreCandidates,
  type CorpusEntry,
  type SignalCorpus,
  type SignalHit,
} from "./signals";

/**
 * JobOrder Intelligence — the determinations.
 *
 *   ... -> JobOrder -> **JobOrder Intelligence** -> Compliance -> ...
 *
 * Understands one recruitment requirement. Nothing else: it generates no
 * advertisement, selects no layout, renders nothing, and makes no
 * compliance judgement — Compliance Intelligence runs next and owns all
 * of that.
 *
 * THE CONTRACT
 *
 *   * Every determination carries Source, Confidence and Reason.
 *   * Every determination is deterministic — no model, no clock, no
 *     randomness. The same JobOrder always yields the same answer.
 *   * When the evidence is not there, the value is UNKNOWN. Never a
 *     guess, never a plausible default.
 *
 * UNKNOWN is a first-class answer here, not a failure. An agency owner
 * can work with "we could not tell whether this is a shutdown". They
 * cannot work with a confident wrong answer, because they will act on it.
 */

export const UNKNOWN = "UNKNOWN" as const;
export type Unknown = typeof UNKNOWN;

export interface Determination<T extends string = string> {
  /** Stable machine name, e.g. "industry", "plantStatus". */
  attribute: string;
  /** The determined value, or UNKNOWN. */
  value: T | Unknown;
  /** 0–100. Zero whenever the value is UNKNOWN. */
  confidencePct: number;
  /** Where the evidence came from, e.g. "position title, source text". */
  source: string;
  /** Plain-language explanation, in the engine's fixed "Detected from:" form. */
  reason: string;
  /** The exact evidence that fired, for display and for audit. */
  signals: string[];
}

const uniqueOrigins = (hits: SignalHit[]): string =>
  [...new Set(hits.map((hit) => hit.origin))].sort().join(", ");

/** Evidence lines, de-duplicated, in the order they were found. */
const evidenceOf = (hits: SignalHit[]): string[] => [...new Set(hits.map((hit) => hit.excerpt))];

function unknownDetermination(attribute: string, reason: string): Determination {
  return { attribute, value: UNKNOWN, confidencePct: 0, source: "none", reason, signals: [] };
}

/** The engine's one reason format, so every explanation reads the same way. */
function detectedFrom(hits: SignalHit[]): string {
  return `Detected from: ${evidenceOf(hits).join(", ")}`;
}

/**
 * Resolves one taxonomy-driven attribute.
 *
 * A winner must both clear the confidence threshold AND beat the
 * runner-up on strong evidence. Two candidates tied on strong signals
 * means the requirement genuinely reads both ways — a refinery
 * turnaround staffed by a construction contractor is a real thing — and
 * picking one would be a coin toss dressed up as a determination.
 */
function resolve<T extends string>(
  attribute: string,
  entries: Parameters<typeof scoreCandidates<T>>[0],
  corpus: CorpusEntry[],
  noEvidenceReason: string,
): Determination<T> {
  const candidates = scoreCandidates(entries, corpus);

  if (candidates.length === 0) {
    return unknownDetermination(attribute, noEvidenceReason) as Determination<T>;
  }

  const [best, runnerUp] = candidates;

  if (best.confidencePct < CONFIDENCE_THRESHOLD) {
    return unknownDetermination(
      attribute,
      `Only weak or partial evidence was found (${evidenceOf(best.hits).join(", ")}), which is not enough to determine this. Reported as UNKNOWN rather than guessed.`,
    ) as Determination<T>;
  }

  if (runnerUp && runnerUp.strongCount === best.strongCount && runnerUp.confidencePct === best.confidencePct) {
    return unknownDetermination(
      attribute,
      `Evidence points equally to "${best.value}" (${evidenceOf(best.hits).join(", ")}) and "${runnerUp.value}" (${evidenceOf(runnerUp.hits).join(", ")}). Reported as UNKNOWN rather than choosing between them.`,
    ) as Determination<T>;
  }

  return {
    attribute,
    value: best.value,
    confidencePct: best.confidencePct,
    source: uniqueOrigins(best.hits),
    reason: detectedFrom(best.hits),
    signals: evidenceOf(best.hits),
  };
}

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export interface PositionInput {
  title: string;
  normalizedTitle: string;
  count: number | null;
  experience: string | null;
  qualifications: string[] | null;
  sortOrder: number;
}

export interface JobOrderInput {
  title: string;
  industry: string;
  country: string;
  employerName: string | null;
  /** From the requirement's projectType fact, when one was established. */
  projectType: string | null;
  positions: PositionInput[];
  /** Text the Requirement Intelligence engine actually read, per source. */
  sourceTexts: string[];
}

/** Values the Requirement Intelligence engine records when nothing was stated. */
const NOT_STATED = new Set(["", "not stated", "unknown", "n/a", "na", "tbd"]);

const isStated = (value: string | null | undefined): value is string =>
  value !== null && value !== undefined && !NOT_STATED.has(value.trim().toLowerCase());

/** Assembles everything the engine may read, each piece labelled with its origin. */
export function buildCorpus(input: JobOrderInput): SignalCorpus {
  const entries: CorpusEntry[] = [];

  if (isStated(input.title)) entries.push({ origin: "requirement title", text: input.title });
  if (isStated(input.industry)) entries.push({ origin: "industry field", text: input.industry });
  if (isStated(input.employerName)) entries.push({ origin: "employer name", text: input.employerName });
  if (isStated(input.projectType)) entries.push({ origin: "project", text: input.projectType });

  for (const position of input.positions) {
    entries.push({ origin: "position title", text: position.title });
    for (const qualification of position.qualifications ?? []) {
      entries.push({ origin: "qualification", text: qualification });
    }
  }

  for (const text of input.sourceTexts) {
    if (text.trim().length > 0) entries.push({ origin: "source text", text });
  }

  return { entries, positionTitles: input.positions.map((position) => position.title) };
}

// ---------------------------------------------------------------------------
// Individual determinations
// ---------------------------------------------------------------------------

export function determineIndustry(corpus: SignalCorpus): Determination<Industry> {
  return resolve<Industry>(
    "industry",
    INDUSTRY_SIGNALS,
    corpus.entries,
    "No industry could be determined — nothing in the requirement matched a known industry.",
  );
}

/**
 * Sector follows from industry and is never detected on its own.
 *
 * A separately-detected sector could contradict the industry it belongs
 * to, and the pair would then be unexplainable. One derivation, one
 * answer.
 */
export function determineSector(industry: Determination<Industry>): Determination {
  if (industry.value === UNKNOWN) {
    return unknownDetermination(
      "sector",
      "Sector follows from industry, and the industry is UNKNOWN.",
    );
  }
  const sector = SECTOR_OF[industry.value as Industry];
  return {
    attribute: "sector",
    value: sector,
    confidencePct: industry.confidencePct,
    source: industry.source,
    reason: `Derived from industry "${industry.value}", which belongs to the ${sector} sector. Confidence carried over from the industry determination.`,
    signals: industry.signals,
  };
}

/**
 * Country is taken from the JobOrder's own field, which Requirement
 * Intelligence already canonicalized under a deterministic rule. It is
 * NOT re-detected from text — the requirement's destination has one
 * owner, and re-deriving it here could contradict the record.
 */
export function determineCountry(input: JobOrderInput): Determination {
  if (!isStated(input.country)) {
    return unknownDetermination("country", "No destination country is recorded on this requirement.");
  }
  return {
    attribute: "country",
    value: input.country,
    confidencePct: 95,
    source: "requirement record",
    reason: `Taken from the requirement's destination field, canonicalized by Requirement Intelligence as "${input.country}".`,
    signals: [input.country],
  };
}

/** Employer likewise comes from the linked Employer entity, not from re-reading text. */
export function determineEmployer(input: JobOrderInput): Determination {
  if (!isStated(input.employerName)) {
    return unknownDetermination(
      "employer",
      "No employer is linked to this requirement. Recorded as UNKNOWN rather than inferred from the text.",
    );
  }
  return {
    attribute: "employer",
    value: input.employerName,
    confidencePct: 95,
    source: "requirement record",
    reason: `Taken from the employer linked to this requirement: "${input.employerName}".`,
    signals: [input.employerName],
  };
}

/**
 * Project name is reported ONLY when the requirement explicitly carried
 * one. There is no attempt to construct a name from the employer and
 * destination — an invented project name is exactly the kind of
 * plausible detail that ends up printed on an advertisement.
 */
export function determineProjectName(input: JobOrderInput): Determination {
  if (!isStated(input.projectType)) {
    return unknownDetermination(
      "projectName",
      "No project was named in the requirement. Recorded as UNKNOWN rather than constructed from the employer or destination.",
    );
  }
  return {
    attribute: "projectName",
    value: input.projectType,
    confidencePct: 90,
    source: "project",
    reason: `Stated in the requirement as "${input.projectType}".`,
    signals: [input.projectType],
  };
}

export function determinePlantType(corpus: SignalCorpus): Determination {
  return resolve(
    "plantType",
    PLANT_TYPE_SIGNALS,
    corpus.entries,
    "No plant type could be determined — the requirement names no recognisable facility.",
  );
}

export function determinePlantStatus(corpus: SignalCorpus): Determination {
  return resolve(
    "plantStatus",
    PLANT_STATUS_SIGNALS,
    corpus.entries,
    "No plant status could be determined — the requirement does not say whether this is a running plant, shutdown, turnaround, commissioning or construction scope.",
  );
}

/**
 * Trade categories, read from POSITION TITLES only.
 *
 * A trade category is a property of the role, and the surrounding
 * narrative is full of words that would mis-categorize it — a shutdown
 * scope document mentions scaffolding whether or not a single scaffolder
 * is being hired. Every category with a strong title match is returned:
 * unlike the single-answer fields, a requirement legitimately spans many
 * trades, and reporting only the biggest would hide the rest.
 */
export function determineTradeCategories(corpus: SignalCorpus): {
  determination: Determination;
  categories: TradeCategory[];
} {
  const titleCorpus: CorpusEntry[] = corpus.positionTitles.map((title) => ({
    origin: "position title" as const,
    text: title,
  }));

  const matched: { category: TradeCategory; hits: SignalHit[] }[] = [];
  for (const entry of TRADE_CATEGORY_SIGNALS) {
    const hits = findSignals(entry, titleCorpus);
    if (hits.some((hit) => hit.strength === "STRONG")) {
      matched.push({ category: entry.value, hits });
    }
  }

  if (matched.length === 0) {
    return {
      determination: unknownDetermination(
        "tradeCategories",
        "No position title matched a known trade category.",
      ),
      categories: [],
    };
  }

  matched.sort((a, b) => a.category.localeCompare(b.category));
  const categories = matched.map((item) => item.category);
  const allHits = matched.flatMap((item) => item.hits);

  return {
    determination: {
      attribute: "tradeCategories",
      value: categories.join(", "),
      confidencePct: confidenceFor(matched.length >= 3 ? 3 : matched.length, 0),
      source: "position title",
      reason: detectedFrom(allHits),
      signals: evidenceOf(allHits),
    },
    categories,
  };
}

/**
 * Number of distinct trades.
 *
 * Counted on the Task 001 normalized title, so "Welder", "WELDER" and
 * "welder " are one trade rather than three. Structural, so it is always
 * knowable when there are positions at all.
 */
export function determineTradeCount(input: JobOrderInput): Determination {
  if (input.positions.length === 0) {
    return unknownDetermination("tradeCount", "This requirement has no positions.");
  }
  const distinct = new Set(input.positions.map((position) => position.normalizedTitle));
  return {
    attribute: "tradeCount",
    value: String(distinct.size),
    confidencePct: 100,
    source: "requirement record",
    reason: `Counted directly from the requirement: ${input.positions.length} position line${input.positions.length === 1 ? "" : "s"} covering ${distinct.size} distinct trade${distinct.size === 1 ? "" : "s"}.`,
    signals: [...distinct].sort(),
  };
}

/**
 * Candidate scarcity — how hard this requirement will actually be to fill.
 *
 * Driven by the scarcest trade present, not by the average: a drive for
 * 200 helpers and 4 analyzer technicians is not an easy drive, because
 * the 4 are what will hold up mobilization. Certifications escalate it,
 * since a ticketed pool is dramatically smaller than the trade's.
 */
export function determineScarcity(
  categories: TradeCategory[],
  input: JobOrderInput,
  corpus: SignalCorpus,
): Determination {
  if (categories.length === 0) {
    return unknownDetermination(
      "candidateScarcity",
      "Scarcity follows from the trades required, and no trade category could be determined.",
    );
  }

  const order = ["Abundant", "Moderate", "Scarce", "Very Scarce"] as const;
  let worstIndex = 0;
  let driver = categories[0];

  for (const category of categories) {
    const tier = TRADE_SCARCITY[category];
    const index = order.indexOf(tier);
    if (index > worstIndex) {
      worstIndex = index;
      driver = category;
    }
  }

  const certificationHits = SCARCE_CERTIFICATIONS.filter((certification) =>
    corpus.entries.some(
      (entry) =>
        entry.origin === "qualification" &&
        new RegExp(`(^|[^a-z0-9])${certification.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`, "i").test(
          entry.text,
        ),
    ),
  );

  const escalated = certificationHits.length > 0 && worstIndex < order.length - 1;
  const finalIndex = escalated ? worstIndex + 1 : worstIndex;

  // Certifications are acronyms and are shown as recruiters write them.
  // The taxonomy stores them lowercased for matching only.
  const certificationLabels = certificationHits.map((certification) => certification.toUpperCase());

  const reasonParts = [
    `The scarcest trade required is ${driver}, which is ${TRADE_SCARCITY[driver]} in the Indian subcontinent supply pool.`,
  ];
  if (escalated) {
    reasonParts.push(
      `Escalated one tier because the requirement demands certification (${certificationLabels.join(", ")}), which shrinks the qualified pool well below the trade's own.`,
    );
  }
  reasonParts.push("Scarcity follows the hardest trade to source, not the average, because that trade is what holds up mobilization.");

  return {
    attribute: "candidateScarcity",
    value: order[finalIndex],
    confidencePct: 85,
    source: "position title" + (certificationHits.length > 0 ? ", qualification" : ""),
    reason: reasonParts.join(" "),
    signals: [driver, ...certificationLabels],
  };
}

/**
 * Recruitment complexity — how hard this requirement is to RUN, as
 * distinct from how hard the people are to find.
 *
 * Trade spread is the dominant term: sourcing 14 trades means 14 parallel
 * pipelines, 14 trade tests and one interview panel that has to cover all
 * of it. Scarcity and scale escalate from there.
 */
export function determineComplexity(
  input: JobOrderInput,
  categories: TradeCategory[],
  scarcity: Determination,
): Determination {
  if (input.positions.length === 0) {
    return unknownDetermination("recruitmentComplexity", "This requirement has no positions.");
  }

  const distinctTrades = new Set(input.positions.map((position) => position.normalizedTitle)).size;
  const statedHeadcount = input.positions.reduce((sum, position) => sum + (position.count ?? 0), 0);

  let points = 0;
  const drivers: string[] = [];

  if (distinctTrades >= 10) {
    points += 3;
    drivers.push(`${distinctTrades} distinct trades to source in parallel`);
  } else if (distinctTrades >= 5) {
    points += 2;
    drivers.push(`${distinctTrades} distinct trades to source in parallel`);
  } else if (distinctTrades >= 2) {
    points += 1;
    drivers.push(`${distinctTrades} distinct trades`);
  }

  if (statedHeadcount >= 100) {
    points += 3;
    drivers.push(`${statedHeadcount} stated positions to mobilize`);
  } else if (statedHeadcount >= 30) {
    points += 2;
    drivers.push(`${statedHeadcount} stated positions to mobilize`);
  } else if (statedHeadcount >= 10) {
    points += 1;
    drivers.push(`${statedHeadcount} stated positions`);
  }

  if (scarcity.value === "Very Scarce") {
    points += 3;
    drivers.push("a Very Scarce trade in the mix");
  } else if (scarcity.value === "Scarce") {
    points += 2;
    drivers.push("a Scarce trade in the mix");
  }

  if (categories.includes("QA/QC") || categories.includes("Instrumentation")) {
    points += 1;
    drivers.push("certification-gated trades requiring trade tests");
  }

  const level = points >= 8 ? "Very High" : points >= 5 ? "High" : points >= 2 ? "Moderate" : "Low";

  return {
    attribute: "recruitmentComplexity",
    value: level,
    confidencePct: 85,
    source: "requirement record",
    reason:
      drivers.length > 0
        ? `Assessed as ${level} from: ${drivers.join("; ")}.`
        : `Assessed as ${level}: a single trade, small headcount, and no scarce or certification-gated roles.`,
    signals: drivers,
  };
}

/**
 * Languages, read only from explicit statements.
 *
 * The destination is deliberately NOT used to infer a language. Most Gulf
 * site work is run in English or in the workers' own languages, and
 * printing "Arabic required" on an advertisement because the job is in
 * Saudi Arabia would invent a requirement the employer never set and
 * exclude candidates who would have been hired.
 */
export function determineLanguages(corpus: SignalCorpus): Determination {
  const candidates = scoreCandidates(LANGUAGE_SIGNALS, corpus.entries).filter(
    (candidate) => candidate.strongCount > 0,
  );

  if (candidates.length === 0) {
    return unknownDetermination(
      "languagesRequired",
      "No language requirement was stated. Recorded as UNKNOWN rather than inferred from the destination country.",
    );
  }

  const sorted = [...candidates].sort((a, b) => a.value.localeCompare(b.value));
  const allHits = sorted.flatMap((candidate) => candidate.hits);

  return {
    attribute: "languagesRequired",
    value: sorted.map((candidate) => candidate.value).join(", "),
    confidencePct: confidenceFor(Math.min(sorted.length, 3), 0),
    source: uniqueOrigins(allHits),
    reason: detectedFrom(allHits),
    signals: evidenceOf(allHits),
  };
}

export function determineUrgency(corpus: SignalCorpus): Determination {
  const resolved = resolve(
    "urgency",
    URGENCY_SIGNALS,
    corpus.entries,
    "No urgency was stated in the requirement. Interview-date proximity is deliberately not used, because it depends on today's date and would make the same requirement classify differently tomorrow.",
  );
  if (resolved.value !== UNKNOWN) return resolved;

  // Silence only means "not urgent" if there was something to be silent
  // IN. A requirement with no readable text at all supports no
  // conclusion about urgency, and calling it Normal would be asserting
  // something about nothing.
  if (corpus.entries.length === 0) {
    return unknownDetermination(
      "urgency",
      "The requirement carries no readable text, so nothing supports any conclusion about urgency.",
    );
  }

  // No urgency wording is itself an answer: a requirement that does not
  // shout is a normal one. Reported at modest confidence, since silence
  // is weaker evidence than a statement.
  return {
    attribute: "urgency",
    value: "Normal",
    confidencePct: 60,
    source: "requirement record",
    reason:
      "No urgency wording appears anywhere in the requirement, so it is treated as a normal-priority hire. Interview-date proximity is deliberately not used, because it depends on today's date and would make the same requirement classify differently tomorrow.",
    signals: [],
  };
}

/**
 * Hiring pattern — the STRUCTURAL shape of the demand.
 *
 * Distinct from Recruitment Pattern below, which is the campaign type.
 * This one is read purely from the numbers: how many trades, how many
 * people, how senior. A bulk mobilization is a bulk mobilization whether
 * or not anyone wrote the words.
 */
export function determineHiringPattern(
  input: JobOrderInput,
  categories: TradeCategory[],
): Determination {
  if (input.positions.length === 0) {
    return unknownDetermination("hiringPattern", "This requirement has no positions.");
  }

  const distinctTrades = new Set(input.positions.map((position) => position.normalizedTitle)).size;
  const stated = input.positions.filter((position) => position.count !== null);
  const headcount = stated.reduce((sum, position) => sum + (position.count ?? 0), 0);

  if (stated.length === 0) {
    return unknownDetermination(
      "hiringPattern",
      "No position states a headcount, so the shape of the hire cannot be determined from the requirement's structure.",
    );
  }

  const managementOnly =
    categories.length > 0 && categories.every((category) => category === "Supervision & Management");

  if (managementOnly) {
    return {
      attribute: "hiringPattern",
      value: "Management Hiring",
      confidencePct: 90,
      source: "position title",
      reason: `Every position is a supervisory or management role (${distinctTrades} distinct title${distinctTrades === 1 ? "" : "s"}, ${headcount} stated position${headcount === 1 ? "" : "s"}).`,
      signals: input.positions.map((position) => position.title),
    };
  }

  if (headcount >= 50) {
    return {
      attribute: "hiringPattern",
      value: "Bulk Mobilization",
      confidencePct: 92,
      source: "requirement record",
      reason: `${headcount} stated positions across ${distinctTrades} trade${distinctTrades === 1 ? "" : "s"} — a bulk mobilization by scale.`,
      signals: [`${headcount} stated positions`, `${distinctTrades} trades`],
    };
  }

  if (headcount <= 3 && distinctTrades <= 2) {
    return {
      attribute: "hiringPattern",
      value: "Specialist Hiring",
      confidencePct: 85,
      source: "requirement record",
      reason: `Only ${headcount} stated position${headcount === 1 ? "" : "s"} across ${distinctTrades} trade${distinctTrades === 1 ? "" : "s"} — a targeted specialist hire rather than a drive.`,
      signals: [`${headcount} stated positions`, `${distinctTrades} trades`],
    };
  }

  return {
    attribute: "hiringPattern",
    value: "Team Hiring",
    confidencePct: 80,
    source: "requirement record",
    reason: `${headcount} stated positions across ${distinctTrades} trade${distinctTrades === 1 ? "" : "s"} — a team-sized hire, neither a bulk drive nor a single specialist.`,
    signals: [`${headcount} stated positions`, `${distinctTrades} trades`],
  };
}

/**
 * Recruitment pattern — the campaign this requirement represents.
 *
 * Text-driven patterns are matched first, because a requirement that
 * says "shutdown" is a shutdown campaign regardless of its size. Only
 * when the wording decides nothing does the structural shape stand in,
 * and that fallback is stated in the reason so the two are never
 * confused.
 */
export function determineRecruitmentPattern(
  corpus: SignalCorpus,
  hiringPattern: Determination,
): Determination {
  const fromText = resolve(
    "recruitmentPattern",
    RECRUITMENT_PATTERN_SIGNALS,
    corpus.entries,
    "The requirement's wording names no recognisable campaign type.",
  );

  if (fromText.value !== UNKNOWN) return fromText;

  const structural = new Set(["Bulk Mobilization", "Specialist Hiring", "Management Hiring"]);
  if (typeof hiringPattern.value === "string" && structural.has(hiringPattern.value)) {
    return {
      attribute: "recruitmentPattern",
      value: hiringPattern.value,
      confidencePct: Math.min(hiringPattern.confidencePct, 75),
      source: hiringPattern.source,
      reason: `The requirement's wording names no campaign type, so the pattern was taken from the shape of the demand instead: ${hiringPattern.reason}`,
      signals: hiringPattern.signals,
    };
  }

  return unknownDetermination(
    "recruitmentPattern",
    "The requirement names no campaign type, and its structure does not resolve to one either. Reported as UNKNOWN rather than guessed.",
  );
}

/**
 * Suggested publication channels.
 *
 * A SUGGESTION attached to the requirement, not a distribution decision:
 * this engine publishes nothing and schedules nothing. The rules are the
 * obvious ones an experienced recruiter applies — a bulk general-trade
 * drive and a single certified specialist are not advertised in the same
 * place — and each suggestion states which property of the requirement
 * produced it.
 */
export function determineChannels(params: {
  hiringPattern: Determination;
  scarcity: Determination;
  categories: TradeCategory[];
}): Determination {
  const { hiringPattern, scarcity, categories } = params;
  const suggestions = new Map<string, string>();

  if (hiringPattern.value === "Bulk Mobilization") {
    suggestions.set("Regional newspaper (trade classifieds)", "a bulk mobilization needs the widest possible local reach");
    suggestions.set("WhatsApp trade groups", "bulk drives are filled largely through existing worker networks");
    suggestions.set("Recruitment centre walk-in", "high headcount is best served by an open trade-test day");
  }

  if (hiringPattern.value === "Specialist Hiring" || scarcity.value === "Very Scarce" || scarcity.value === "Scarce") {
    suggestions.set("Targeted trade-network outreach", "a scarce or specialist role is found through direct approach, not volume advertising");
    suggestions.set("Professional networks", "certified and supervisory candidates are reachable individually");
  }

  if (hiringPattern.value === "Management Hiring") {
    suggestions.set("Professional networks", "management candidates respond to direct, discreet approach rather than open advertising");
  }

  if (categories.includes("Healthcare")) {
    suggestions.set("Licensed healthcare job boards", "healthcare hiring is gated on licensing and is sourced through specialist boards");
  }

  if (categories.includes("Hospitality") || categories.includes("General Labour") || categories.includes("Driving & Logistics")) {
    suggestions.set("Regional newspaper (trade classifieds)", "general and service trades still respond strongly to print classifieds");
    suggestions.set("WhatsApp trade groups", "these trades circulate openings peer-to-peer");
  }

  if (suggestions.size === 0) {
    return unknownDetermination(
      "suggestedChannels",
      "No channel suggestion could be made — the requirement's shape and trades did not match any channel rule.",
    );
  }

  const sorted = [...suggestions.entries()].sort(([a], [b]) => a.localeCompare(b));

  return {
    attribute: "suggestedChannels",
    value: sorted.map(([channel]) => channel).join(", "),
    confidencePct: 75,
    source: "requirement record",
    reason: `Suggested from the shape of this requirement: ${sorted.map(([channel, why]) => `${channel} — ${why}`).join("; ")}. These are suggestions attached to the requirement; nothing is published by this engine.`,
    signals: sorted.map(([channel]) => channel),
  };
}

// ---------------------------------------------------------------------------
// The full assessment
// ---------------------------------------------------------------------------

export interface JobOrderIntelligenceResult {
  determinations: Determination[];
  /** Mean confidence across determinations that resolved to a value. */
  overallConfidencePct: number;
  /** Attributes that came back UNKNOWN — the honest gaps. */
  unknownAttributes: string[];
}

/**
 * Runs every determination for one requirement.
 *
 * Order is fixed and the output is a plain list, so the same JobOrder
 * always produces the same determinations in the same order.
 */
export function assessJobOrder(input: JobOrderInput): JobOrderIntelligenceResult {
  const corpus = buildCorpus(input);

  const industry = determineIndustry(corpus);
  const sector = determineSector(industry);
  const country = determineCountry(input);
  const employer = determineEmployer(input);
  const projectName = determineProjectName(input);
  const plantType = determinePlantType(corpus);
  const plantStatus = determinePlantStatus(corpus);
  const { determination: tradeCategories, categories } = determineTradeCategories(corpus);
  const tradeCount = determineTradeCount(input);
  const scarcity = determineScarcity(categories, input, corpus);
  const complexity = determineComplexity(input, categories, scarcity);
  const languages = determineLanguages(corpus);
  const urgency = determineUrgency(corpus);
  const hiringPattern = determineHiringPattern(input, categories);
  const recruitmentPattern = determineRecruitmentPattern(corpus, hiringPattern);
  const channels = determineChannels({ hiringPattern, scarcity, categories });

  const determinations: Determination[] = [
    industry, sector, country, employer, projectName, plantType, plantStatus,
    tradeCategories, tradeCount, complexity, scarcity, languages, channels,
    urgency, hiringPattern, recruitmentPattern,
  ];

  const resolved = determinations.filter((determination) => determination.value !== UNKNOWN);
  const overallConfidencePct =
    resolved.length === 0
      ? 0
      : Math.round(resolved.reduce((sum, d) => sum + d.confidencePct, 0) / resolved.length);

  return {
    determinations,
    overallConfidencePct,
    unknownAttributes: determinations
      .filter((determination) => determination.value === UNKNOWN)
      .map((determination) => determination.attribute),
  };
}

/**
 * Region Intelligence — OBJECTIVE RECRUITMENT INTELLIGENCE ONLY.
 *
 * ============================ HARD PROHIBITIONS ============================
 * This module does not, and may never, do any of the following:
 *
 *   - psychological profiling of candidates or regions
 *   - behavioural targeting
 *   - inference of emotion, mood, aspiration, desperation or motivation
 *   - inference of literacy, education level or comprehension ability
 *   - persuasion tuning of any kind aimed at a person or a population
 *
 * Nothing here scores, segments or characterises a human being. There is
 * deliberately no field on any type below that could hold such a value, so
 * a future change would have to add one explicitly and would be visible in
 * review. If a feature request needs any of the above, the correct answer
 * is that KAI does not build it.
 * ===========================================================================
 *
 * What it DOES hold is the objective, checkable market knowledge an
 * experienced overseas-recruitment consultant already has, and which the
 * product otherwise forces every recruiter to re-supply by hand:
 *
 *   - candidate supply geography (which Indian states supply which trades)
 *   - industry hiring corridors (which destinations hire which industries)
 *   - trade popularity by state
 *   - language preference (which languages an advertisement is likely to
 *     need alongside English, given where the trade is recruited from)
 *   - seasonal availability (when a corridor's hiring actually happens)
 *   - typical project background (what the work physically looks like)
 *   - industry imagery (what the background artwork should depict)
 *
 * All of it is used for exactly two things: choosing honest background
 * artwork, and choosing which language the advertisement is offered in.
 * Neither changes a single recruitment fact.
 */

export type IndianState =
  | "KERALA"
  | "TAMIL_NADU"
  | "ANDHRA_PRADESH"
  | "TELANGANA"
  | "KARNATAKA"
  | "MAHARASHTRA"
  | "GUJARAT"
  | "RAJASTHAN"
  | "PUNJAB"
  | "HARYANA"
  | "UTTAR_PRADESH"
  | "BIHAR"
  | "JHARKHAND"
  | "WEST_BENGAL"
  | "ODISHA"
  | "ASSAM";

/** ISO-639-1 where one exists; these are advertisement languages, not dialects. */
export type RecruitmentLanguage =
  | "en"
  | "hi"
  | "ml"
  | "ta"
  | "te"
  | "kn"
  | "mr"
  | "gu"
  | "pa"
  | "bn"
  | "or"
  | "as";

export interface SupplyRegion {
  state: IndianState;
  label: string;
  /** Languages an advertisement circulated in this state commonly needs. */
  languages: RecruitmentLanguage[];
  /**
   * Trades this state is a recognised supply source for. Substring-matched
   * against position titles, case-insensitively.
   */
  trades: string[];
}

/**
 * Candidate supply geography. Sourced from published emigration-clearance
 * patterns and standard trade-corridor practice; it describes where a
 * trade is recruited FROM, nothing about the people recruited.
 */
export const SUPPLY_REGIONS: SupplyRegion[] = [
  {
    state: "KERALA",
    label: "Kerala",
    languages: ["ml", "en"],
    trades: ["nurse", "nursing", "paramedic", "lab technician", "pharmacist", "hospitality", "chef", "steward"],
  },
  {
    state: "TAMIL_NADU",
    label: "Tamil Nadu",
    languages: ["ta", "en"],
    trades: ["welder", "fitter", "machinist", "electrician", "driver", "textile", "fabricator"],
  },
  {
    state: "ANDHRA_PRADESH",
    label: "Andhra Pradesh",
    languages: ["te", "en"],
    trades: ["mason", "carpenter", "steel fixer", "helper", "painter", "plumber"],
  },
  {
    state: "TELANGANA",
    label: "Telangana",
    languages: ["te", "hi", "en"],
    trades: ["driver", "helper", "housekeeping", "security", "mason"],
  },
  {
    state: "KARNATAKA",
    label: "Karnataka",
    languages: ["kn", "en"],
    trades: ["technician", "operator", "mechanic", "it", "engineer"],
  },
  {
    state: "MAHARASHTRA",
    label: "Maharashtra",
    languages: ["mr", "hi", "en"],
    trades: ["engineer", "supervisor", "instrumentation", "quality", "safety"],
  },
  {
    state: "GUJARAT",
    label: "Gujarat",
    languages: ["gu", "hi", "en"],
    trades: ["chemical", "refinery", "operator", "diamond", "textile", "pipe fitter"],
  },
  {
    state: "RAJASTHAN",
    label: "Rajasthan",
    languages: ["hi", "en"],
    trades: ["mason", "stone", "marble", "tile", "driver", "helper"],
  },
  {
    state: "PUNJAB",
    label: "Punjab",
    languages: ["pa", "hi", "en"],
    trades: ["driver", "heavy driver", "truck", "crane operator", "agriculture", "transport"],
  },
  {
    state: "HARYANA",
    label: "Haryana",
    languages: ["hi", "en"],
    trades: ["driver", "operator", "security", "logistics", "warehouse"],
  },
  {
    state: "UTTAR_PRADESH",
    label: "Uttar Pradesh",
    languages: ["hi", "en"],
    trades: ["mason", "carpenter", "helper", "labour", "painter", "shuttering"],
  },
  {
    state: "BIHAR",
    label: "Bihar",
    languages: ["hi", "en"],
    trades: ["mason", "helper", "labour", "steel fixer", "scaffolder", "shuttering"],
  },
  {
    state: "JHARKHAND",
    label: "Jharkhand",
    languages: ["hi", "en"],
    trades: ["welder", "helper", "labour", "mining", "steel"],
  },
  {
    state: "WEST_BENGAL",
    label: "West Bengal",
    languages: ["bn", "hi", "en"],
    trades: ["carpenter", "tailor", "goldsmith", "helper", "cook", "scaffolder"],
  },
  {
    state: "ODISHA",
    label: "Odisha",
    languages: ["or", "hi", "en"],
    trades: ["helper", "labour", "mason", "welder", "rigger"],
  },
  {
    state: "ASSAM",
    label: "Assam",
    languages: ["as", "hi", "en"],
    trades: ["helper", "labour", "security", "housekeeping"],
  },
];

export interface HiringCorridor {
  /** Destination country, matched case-insensitively as a substring. */
  country: string;
  label: string;
  /** Industries this destination hires at scale. */
  industries: string[];
  /** What the work physically looks like — art direction, never a claim. */
  typicalProjectBackground: string;
  /**
   * Months when this corridor's mobilisation peaks, 1–12. Used to tell a
   * recruiter when a drive is well timed; never printed on an
   * advertisement and never used to manufacture urgency.
   */
  peakMonths: number[];
}

/**
 * Industry hiring corridors. These describe employer demand, which is a
 * property of markets and projects — not of candidates.
 */
export const HIRING_CORRIDORS: HiringCorridor[] = [
  {
    country: "Saudi Arabia",
    label: "Saudi Arabia",
    industries: ["oil", "gas", "petrochemical", "construction", "infrastructure", "epc", "healthcare"],
    typicalProjectBackground:
      "Large-scale desert construction and process plant: pipe racks, steel erection, giga-project civil works, " +
      "flat arid terrain and hard overhead sun.",
    peakMonths: [1, 2, 3, 9, 10, 11],
  },
  {
    country: "United Arab Emirates",
    label: "United Arab Emirates",
    industries: ["construction", "hospitality", "facility", "logistics", "retail", "healthcare", "mep"],
    typicalProjectBackground:
      "High-rise and fit-out construction, hotels, malls and logistics parks; dense coastal urban skyline, " +
      "humid haze, night working under floodlight.",
    peakMonths: [1, 2, 3, 10, 11, 12],
  },
  {
    country: "Qatar",
    label: "Qatar",
    industries: ["construction", "oil", "gas", "lng", "facility", "hospitality"],
    typicalProjectBackground:
      "LNG trains, port and stadium-scale civil works; coastal industrial estates, flat desert margins.",
    peakMonths: [1, 2, 3, 10, 11, 12],
  },
  {
    country: "Kuwait",
    label: "Kuwait",
    industries: ["oil", "refinery", "construction", "facility", "marine"],
    typicalProjectBackground:
      "Refinery and tank-farm work, shutdown scaffolding, coastal process plant under heavy sun.",
    peakMonths: [2, 3, 4, 10, 11],
  },
  {
    country: "Oman",
    label: "Oman",
    industries: ["oil", "gas", "mining", "construction", "marine", "logistics"],
    typicalProjectBackground:
      "Interior oilfields and coastal industrial ports; mountainous arid backdrop, pipeline corridors.",
    peakMonths: [1, 2, 3, 10, 11],
  },
  {
    country: "Bahrain",
    label: "Bahrain",
    industries: ["oil", "aluminium", "construction", "hospitality", "banking"],
    typicalProjectBackground: "Smelter and refinery plant, causeway and marine civil works, compact coastal island sites.",
    peakMonths: [1, 2, 3, 11, 12],
  },
  {
    country: "Malaysia",
    label: "Malaysia",
    industries: ["manufacturing", "electronics", "plantation", "construction", "oil", "gas"],
    typicalProjectBackground:
      "Manufacturing floors and process plant in tropical humidity; green surroundings, covered walkways, monsoon light.",
    peakMonths: [1, 2, 6, 7, 8],
  },
  {
    country: "Singapore",
    label: "Singapore",
    industries: ["marine", "shipyard", "construction", "process", "logistics"],
    typicalProjectBackground:
      "Shipyards, dry docks and process islands; dense port infrastructure, tropical overcast light.",
    peakMonths: [1, 2, 3, 7, 8],
  },
  {
    country: "Romania",
    label: "Romania",
    industries: ["construction", "manufacturing", "logistics", "agriculture"],
    typicalProjectBackground:
      "European construction and manufacturing sites; temperate light, cold-weather working gear in winter months.",
    peakMonths: [3, 4, 5, 9, 10],
  },
  {
    country: "Poland",
    label: "Poland",
    industries: ["construction", "manufacturing", "logistics", "welding"],
    typicalProjectBackground:
      "Industrial halls, fabrication shops and civil sites under low northern light; cold-weather protective clothing.",
    peakMonths: [3, 4, 5, 9, 10],
  },
];

export interface RegionIntelligence {
  /** Destination corridor, when the country is one KAI has data for. */
  corridor: {
    country: string;
    label: string;
    typicalProjectBackground: string;
    peakMonths: number[];
    /** True when the requirement's industry matches this corridor's demand. */
    industryMatchesCorridor: boolean;
  } | null;
  /** Supply states this requirement's trades are commonly recruited from. */
  supplyRegions: { state: IndianState; label: string }[];
  /**
   * Languages this advertisement is likely to need alongside English,
   * derived from the supply regions above. A SUGGESTION to the recruiter —
   * KAI never translates a verified fact on its own initiative.
   */
  suggestedLanguages: RecruitmentLanguage[];
  /** One line of objective art direction for the background artwork only. */
  imageryDirection: string | null;
}

export interface RegionIntelligenceInput {
  country?: string | null;
  industry?: string | null;
  /** Verified position titles. Read only to match trades to supply states. */
  positionTitles: string[];
}

/**
 * Resolves objective region intelligence for a requirement.
 *
 * Returns nothing at all when there is no matching data — an absent
 * corridor is reported as absent rather than approximated, for the same
 * reason Requirement Intelligence never fills a blank field.
 */
export function resolveRegionIntelligence(input: RegionIntelligenceInput): RegionIntelligence {
  const country = input.country?.toLowerCase().trim() ?? "";
  const industry = input.industry?.toLowerCase().trim() ?? "";

  const match = country
    ? HIRING_CORRIDORS.find(
        (c) => country.includes(c.country.toLowerCase()) || c.country.toLowerCase().includes(country),
      )
    : undefined;

  const corridor = match
    ? {
        country: match.country,
        label: match.label,
        typicalProjectBackground: match.typicalProjectBackground,
        peakMonths: match.peakMonths,
        industryMatchesCorridor: Boolean(industry) && match.industries.some((i) => industry.includes(i)),
      }
    : null;

  const titles = input.positionTitles.map((t) => t.toLowerCase());
  const supply = SUPPLY_REGIONS.filter((region) =>
    region.trades.some((trade) => titles.some((title) => title.includes(trade))),
  );

  // Ordered by how many supply regions call for them, so the first entry is
  // the language the largest part of the likely applicant pool reads. English
  // is always retained because every KAI advertisement is set in it.
  const counts = new Map<RecruitmentLanguage, number>();
  for (const region of supply) {
    for (const lang of region.languages) counts.set(lang, (counts.get(lang) ?? 0) + 1);
  }
  const suggestedLanguages = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([lang]) => lang);
  if (!suggestedLanguages.includes("en")) suggestedLanguages.unshift("en");

  return {
    corridor,
    supplyRegions: supply.map((r) => ({ state: r.state, label: r.label })),
    suggestedLanguages,
    imageryDirection: corridor?.typicalProjectBackground ?? null,
  };
}

/**
 * Whether a drive is well timed for its corridor. Advisory only — shown to
 * the recruiter, never printed, and never turned into urgency copy. KAI
 * does not manufacture urgency (Truth Brain).
 */
export function isPeakHiringMonth(region: RegionIntelligence, month: number): boolean | null {
  if (!region.corridor) return null;
  return region.corridor.peakMonths.includes(month);
}

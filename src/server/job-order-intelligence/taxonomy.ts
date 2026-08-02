/**
 * JobOrder Intelligence — the recruitment vocabulary.
 *
 *   ... -> JobOrder -> **JobOrder Intelligence** -> Compliance -> ...
 *
 * DATA, NOT CODE. Every classification this engine makes is driven by
 * the tables below. Teaching it a new plant type, trade family or
 * campaign shape is a new row here, never a new branch in a classifier.
 *
 * A signal is STRONG when it belongs to essentially one answer — an
 * "Analyzer Technician" is not hired outside process industries — and
 * WEAK when it merely leans that way. "Welder" appears on an oil & gas
 * shutdown, a shipyard and a construction site alike, so on its own it
 * decides nothing.
 *
 * That distinction is the whole engine. It is what lets a determination
 * be made from evidence rather than from a guess, and what lets a field
 * honestly return UNKNOWN when only weak signals fired.
 */

export type SignalStrength = "STRONG" | "WEAK";

export interface TaxonomyEntry<T extends string> {
  value: T;
  strong: string[];
  weak: string[];
}

// ---------------------------------------------------------------------------
// Industry and sector
// ---------------------------------------------------------------------------

export const INDUSTRIES = [
  "Oil & Gas", "Petrochemical", "Power Generation", "Construction",
  "Marine & Shipyard", "Manufacturing", "Hospitality", "Healthcare",
  "Facility Management", "Logistics & Transport", "Aviation", "Retail",
  "Mining", "Agriculture",
] as const;
export type Industry = (typeof INDUSTRIES)[number];

export const INDUSTRY_SIGNALS: TaxonomyEntry<Industry>[] = [
  {
    value: "Oil & Gas",
    strong: ["oil & gas", "oil and gas", "refinery", "upstream", "downstream", "offshore platform", "wellhead", "drilling rig", "analyzer technician", "analyser technician", "process operator", "lng", "petroleum", "aramco", "adnoc", "gas plant"],
    weak: ["instrument technician", "process technician", "turnaround", "shutdown", "flare", "pipeline", "onshore"],
  },
  {
    value: "Petrochemical",
    strong: ["petrochemical", "polymer plant", "ethylene", "propylene", "cracker unit", "fertilizer plant", "fertiliser plant", "urea plant", "ammonia plant", "methanol plant"],
    weak: ["chemical plant", "process plant", "reactor"],
  },
  {
    value: "Power Generation",
    strong: ["power plant", "power generation", "turbine technician", "boiler operator", "substation", "switchyard", "combined cycle", "desalination", "gas turbine", "steam turbine", "grid station"],
    weak: ["electrical maintenance", "high voltage", "transformer"],
  },
  {
    value: "Construction",
    strong: ["construction", "civil works", "building construction", "infrastructure project", "steel structure erection", "formwork carpenter", "shuttering carpenter", "site engineer", "concrete works"],
    weak: ["mason", "steel fixer", "scaffolder", "civil", "shuttering", "block work"],
  },
  {
    value: "Marine & Shipyard",
    strong: ["shipyard", "marine", "dry dock", "vessel repair", "ship building", "hull fabrication", "naval"],
    weak: ["ship fitter", "marine welder"],
  },
  {
    value: "Manufacturing",
    strong: ["manufacturing", "production line", "factory", "cnc machinist", "assembly line", "rolling mill", "steel plant", "cement plant", "paper mill"],
    weak: ["machine operator", "production operator", "quality control"],
  },
  {
    value: "Hospitality",
    strong: ["hospitality", "hotel", "restaurant", "catering", "housekeeping", "food and beverage", "f&b", "chef", "waiter", "barista", "banquet"],
    weak: ["cook", "steward", "cleaner"],
  },
  {
    value: "Healthcare",
    strong: ["hospital", "healthcare", "nurse", "staff nurse", "medical", "clinic", "radiographer", "pharmacist", "physiotherapist", "laboratory technician"],
    weak: ["patient", "ward", "caregiver"],
  },
  {
    value: "Facility Management",
    strong: ["facility management", "facilities management", "soft services", "hard services", "fm contract", "building maintenance"],
    weak: ["housekeeping", "janitor", "cleaner", "maintenance technician"],
  },
  {
    value: "Logistics & Transport",
    strong: ["logistics", "warehouse", "freight", "supply chain", "distribution centre", "distribution center", "forklift operator", "heavy driver", "trailer driver"],
    weak: ["driver", "storekeeper", "loader"],
  },
  {
    value: "Aviation",
    strong: ["aviation", "airport", "aircraft maintenance", "ground handling", "cabin crew", "airline", "ramp agent"],
    weak: ["baggage", "terminal"],
  },
  {
    value: "Retail",
    strong: ["retail", "supermarket", "hypermarket", "showroom", "cashier", "sales associate", "merchandiser"],
    weak: ["salesman", "store"],
  },
  {
    value: "Mining",
    strong: ["mining", "quarry", "mine site", "blasting engineer", "ore processing"],
    weak: ["excavation", "haul truck"],
  },
  {
    value: "Agriculture",
    strong: ["agriculture", "farm", "greenhouse", "poultry", "dairy farm", "plantation"],
    weak: ["harvest", "irrigation"],
  },
];

/** Broader grouping. Derived from the industry, never detected separately. */
export const SECTOR_OF: Record<Industry, string> = {
  "Oil & Gas": "Energy",
  "Petrochemical": "Energy",
  "Power Generation": "Energy",
  "Construction": "Infrastructure",
  "Marine & Shipyard": "Industrial",
  "Manufacturing": "Industrial",
  "Mining": "Primary",
  "Agriculture": "Primary",
  "Hospitality": "Services",
  "Healthcare": "Healthcare",
  "Facility Management": "Services",
  "Logistics & Transport": "Transport",
  "Aviation": "Transport",
  "Retail": "Services",
};

// ---------------------------------------------------------------------------
// Plant type and plant status
// ---------------------------------------------------------------------------

export const PLANT_TYPES = [
  "Refinery", "Petrochemical Complex", "Power Plant", "Desalination Plant",
  "LNG Terminal", "Offshore Platform", "Cement Plant", "Steel Plant",
  "Fertilizer Plant", "Shipyard", "Paper Mill",
] as const;
export type PlantType = (typeof PLANT_TYPES)[number];

export const PLANT_TYPE_SIGNALS: TaxonomyEntry<PlantType>[] = [
  { value: "Refinery", strong: ["refinery", "refineries", "crude distillation", "hydrocracker", "cdu unit"], weak: ["crude unit"] },
  { value: "Petrochemical Complex", strong: ["petrochemical complex", "petrochemical plant", "cracker unit", "polymer plant", "ethylene plant"], weak: ["chemical complex"] },
  { value: "Power Plant", strong: ["power plant", "combined cycle plant", "thermal power", "captive power plant"], weak: ["powerhouse"] },
  { value: "Desalination Plant", strong: ["desalination", "swro plant", "water desalination"], weak: [] },
  { value: "LNG Terminal", strong: ["lng terminal", "lng plant", "liquefaction plant", "regasification"], weak: ["lng"] },
  { value: "Offshore Platform", strong: ["offshore platform", "jacket platform", "fpso", "offshore rig"], weak: ["offshore"] },
  { value: "Cement Plant", strong: ["cement plant", "clinker line", "cement factory"], weak: ["kiln"] },
  { value: "Steel Plant", strong: ["steel plant", "rolling mill", "blast furnace", "steel mill"], weak: ["smelter"] },
  { value: "Fertilizer Plant", strong: ["fertilizer plant", "fertiliser plant", "urea plant", "ammonia plant"], weak: [] },
  { value: "Shipyard", strong: ["shipyard", "dry dock", "ship repair yard"], weak: ["dockyard"] },
  { value: "Paper Mill", strong: ["paper mill", "pulp mill"], weak: [] },
];

/**
 * The plant's operating state — the "Running Plant / Shutdown /
 * Turnaround / Commissioning / Construction" axis.
 *
 * This is the single most commercially loaded field in the whole
 * requirement. A shutdown is a fixed-date, high-intensity, short-duration
 * mobilization; a running plant is a long-term O&M posting. Same trades,
 * completely different campaign, completely different candidate.
 */
export const PLANT_STATUSES = [
  "Running Plant", "Shutdown", "Turnaround", "Commissioning",
  "Pre-Commissioning", "Construction",
] as const;
export type PlantStatus = (typeof PLANT_STATUSES)[number];

export const PLANT_STATUS_SIGNALS: TaxonomyEntry<PlantStatus>[] = [
  { value: "Shutdown", strong: ["shutdown", "shut down job", "sd job", "plant shutdown"], weak: ["outage"] },
  { value: "Turnaround", strong: ["turnaround", "turn around job", "ta job", "major turnaround"], weak: ["overhaul"] },
  { value: "Commissioning", strong: ["commissioning", "start-up support", "startup support"], weak: ["handover"] },
  { value: "Pre-Commissioning", strong: ["pre-commissioning", "pre commissioning", "flushing and testing"], weak: ["loop checking"] },
  { value: "Construction", strong: ["construction phase", "new construction", "erection works", "greenfield construction"], weak: ["site construction", "civil works"] },
  { value: "Running Plant", strong: ["running plant", "operating plant", "o&m contract", "operation and maintenance", "routine maintenance", "annual maintenance contract"], weak: ["plant maintenance", "day to day maintenance"] },
];

// ---------------------------------------------------------------------------
// Trade categories
// ---------------------------------------------------------------------------

export const TRADE_CATEGORIES = [
  "Mechanical", "Electrical", "Instrumentation", "Civil", "Welding & Fabrication",
  "Piping", "Scaffolding", "Rigging & Lifting", "HSE", "QA/QC", "Operations",
  "Painting & Blasting", "Insulation", "HVAC", "Supervision & Management",
  "Hospitality", "Healthcare", "Driving & Logistics", "General Labour",
] as const;
export type TradeCategory = (typeof TRADE_CATEGORIES)[number];

/** Matched against POSITION TITLES only — a trade category is a property of the role. */
export const TRADE_CATEGORY_SIGNALS: TaxonomyEntry<TradeCategory>[] = [
  { value: "Instrumentation", strong: ["instrument technician", "instrumentation", "analyzer technician", "analyser technician", "control technician", "dcs operator", "calibration technician", "instrument fitter"], weak: ["instrument"] },
  { value: "Electrical", strong: ["electrician", "electrical technician", "electrical supervisor", "cable jointer", "high voltage technician", "electrical foreman"], weak: ["electrical"] },
  { value: "Mechanical", strong: ["mechanical technician", "mechanical fitter", "millwright", "machinist", "turbine technician", "pump technician", "mechanic", "mechanical foreman"], weak: ["mechanical", "fitter"] },
  { value: "Welding & Fabrication", strong: ["welder", "fabricator", "structural fabricator", "tig welder", "mig welder", "arc welder", "6g welder", "welding inspector"], weak: ["welding", "fabrication"] },
  { value: "Piping", strong: ["pipe fitter", "pipefitter", "piping supervisor", "pipe fabricator", "plumber"], weak: ["piping", "pipeline"] },
  { value: "Civil", strong: ["mason", "steel fixer", "shuttering carpenter", "formwork carpenter", "civil engineer", "civil foreman", "concrete finisher", "block mason"], weak: ["carpenter", "civil"] },
  { value: "Scaffolding", strong: ["scaffolder", "scaffolding inspector", "scaffolding supervisor", "scaffolding foreman"], weak: ["scaffold"] },
  { value: "Rigging & Lifting", strong: ["rigger", "crane operator", "lifting supervisor", "banksman", "signalman"], weak: ["rigging", "lifting"] },
  { value: "HSE", strong: ["hse officer", "safety officer", "hse supervisor", "safety inspector", "fire watch", "hse manager", "safety engineer"], weak: ["safety", "hse"] },
  { value: "QA/QC", strong: ["qa/qc inspector", "qaqc inspector", "qc inspector", "quality inspector", "ndt technician", "welding qc", "quality engineer"], weak: ["inspector", "quality"] },
  { value: "Operations", strong: ["process operator", "plant operator", "field operator", "panel operator", "boiler operator"], weak: ["operator"] },
  { value: "Painting & Blasting", strong: ["painter", "sandblaster", "blaster", "coating inspector", "industrial painter"], weak: ["painting", "blasting", "coating"] },
  { value: "Insulation", strong: ["insulator", "insulation technician", "cladding technician"], weak: ["insulation", "cladding"] },
  { value: "HVAC", strong: ["hvac technician", "ac technician", "refrigeration technician", "duct fabricator", "chiller technician"], weak: ["hvac", "air conditioning"] },
  { value: "Supervision & Management", strong: ["project manager", "construction manager", "site manager", "superintendent", "general foreman", "planning engineer", "project engineer", "supervisor", "foreman"], weak: ["engineer", "manager", "coordinator"] },
  { value: "Hospitality", strong: ["waiter", "chef", "cook", "housekeeping attendant", "steward", "barista", "front office", "room attendant"], weak: ["kitchen", "hotel"] },
  { value: "Healthcare", strong: ["staff nurse", "nurse", "radiographer", "pharmacist", "physiotherapist", "lab technician", "medical technologist"], weak: ["clinical", "patient"] },
  { value: "Driving & Logistics", strong: ["heavy driver", "light driver", "trailer driver", "forklift operator", "storekeeper", "warehouse assistant", "bus driver"], weak: ["driver", "warehouse"] },
  { value: "General Labour", strong: ["helper", "labourer", "laborer", "cleaner", "general worker", "office boy"], weak: ["assistant"] },
];

// ---------------------------------------------------------------------------
// Candidate scarcity
// ---------------------------------------------------------------------------

export type ScarcityTier = "Abundant" | "Moderate" | "Scarce" | "Very Scarce";

/**
 * How hard a trade actually is to source out of the Indian subcontinent.
 *
 * These are recruitment facts, not opinions: certified and ticketed roles
 * have a genuinely small qualified pool, while helpers and cleaners do
 * not. Scarcity drives how long a campaign must run and how wide it must
 * be cast — it is the number an owner needs before promising a principal
 * a mobilization date.
 */
export const TRADE_SCARCITY: Record<TradeCategory, ScarcityTier> = {
  "Instrumentation": "Very Scarce",
  "QA/QC": "Very Scarce",
  "Operations": "Scarce",
  "HSE": "Scarce",
  "Supervision & Management": "Scarce",
  "Healthcare": "Scarce",
  "Welding & Fabrication": "Moderate",
  "Electrical": "Moderate",
  "Mechanical": "Moderate",
  "Piping": "Moderate",
  "HVAC": "Moderate",
  "Rigging & Lifting": "Moderate",
  "Insulation": "Moderate",
  "Painting & Blasting": "Moderate",
  "Scaffolding": "Abundant",
  "Civil": "Abundant",
  "Hospitality": "Abundant",
  "Driving & Logistics": "Abundant",
  "General Labour": "Abundant",
};

/** Certifications that shrink the qualified pool sharply wherever they appear. */
export const SCARCE_CERTIFICATIONS = [
  "cswip", "aws cwi", "bgas", "nace", "api 510", "api 570", "api 653",
  "nebosh", "iosh", "6g", "asnt level ii", "asnt level 2", "pcn",
  "bosiet", "hu et", "opito", "tuv", "ndt level ii",
];

// ---------------------------------------------------------------------------
// Languages
// ---------------------------------------------------------------------------

export const LANGUAGE_SIGNALS: TaxonomyEntry<string>[] = [
  { value: "English", strong: ["english speaking", "fluent english", "english mandatory", "good english", "english required"], weak: ["english"] },
  { value: "Arabic", strong: ["arabic speaking", "fluent arabic", "arabic mandatory", "arabic required"], weak: ["arabic"] },
  { value: "Hindi", strong: ["hindi speaking", "hindi required"], weak: ["hindi"] },
  { value: "Malayalam", strong: ["malayalam speaking", "malayalam required"], weak: ["malayalam"] },
  { value: "Tamil", strong: ["tamil speaking", "tamil required"], weak: ["tamil"] },
  { value: "Nepali", strong: ["nepali speaking", "nepali required"], weak: ["nepali"] },
  { value: "Bengali", strong: ["bengali speaking", "bangla required"], weak: ["bengali"] },
  { value: "Urdu", strong: ["urdu speaking", "urdu required"], weak: ["urdu"] },
];

// ---------------------------------------------------------------------------
// Urgency
// ---------------------------------------------------------------------------

export type Urgency = "Immediate" | "High" | "Normal";

/**
 * Urgency is read ONLY from what the requirement says.
 *
 * It deliberately ignores how close the interview date is, even though
 * that is tempting and would often be right. Proximity depends on today's
 * date, so the same requirement would classify differently tomorrow — and
 * this engine's contract is that a determination is reproducible forever.
 * A clock has no place in a deterministic classifier.
 */
export const URGENCY_SIGNALS: TaxonomyEntry<Urgency>[] = [
  { value: "Immediate", strong: ["immediate joining", "immediately required", "mobilize immediately", "asap", "as soon as possible", "immediate mobilization", "urgent requirement", "very urgent"], weak: ["immediate"] },
  { value: "High", strong: ["urgent", "priority requirement", "fast track", "expedite"], weak: ["soon", "quickly"] },
];

// ---------------------------------------------------------------------------
// Recruitment pattern
// ---------------------------------------------------------------------------

export const RECRUITMENT_PATTERNS = [
  "Shutdown Campaign", "Annual Maintenance", "Long Term O&M", "Construction",
  "Brownfield", "Greenfield", "Commissioning", "Emergency Hiring",
  "Replacement Hiring", "Bulk Mobilization", "Specialist Hiring", "Management Hiring",
] as const;
export type RecruitmentPattern = (typeof RECRUITMENT_PATTERNS)[number];

/**
 * Text-driven campaign shapes. The remaining patterns — Bulk
 * Mobilization, Specialist Hiring, Management Hiring — are decided from
 * the requirement's STRUCTURE rather than its wording, in
 * determinations.ts, because a bulk drive is bulk whether or not anyone
 * wrote the word.
 */
export const RECRUITMENT_PATTERN_SIGNALS: TaxonomyEntry<RecruitmentPattern>[] = [
  { value: "Shutdown Campaign", strong: ["shutdown", "sd job", "plant shutdown", "turnaround", "ta job"], weak: ["outage", "overhaul"] },
  { value: "Annual Maintenance", strong: ["annual maintenance", "amc contract", "annual maintenance contract", "yearly maintenance"], weak: ["periodic maintenance"] },
  { value: "Long Term O&M", strong: ["o&m contract", "operation and maintenance", "long term contract", "running plant", "operating plant"], weak: ["long term", "permanent position"] },
  { value: "Greenfield", strong: ["greenfield", "green field project", "new plant construction"], weak: ["new project"] },
  { value: "Brownfield", strong: ["brownfield", "brown field project", "plant expansion", "revamp project", "debottlenecking"], weak: ["expansion", "revamp"] },
  { value: "Commissioning", strong: ["commissioning", "pre-commissioning", "start-up support"], weak: ["startup"] },
  { value: "Construction", strong: ["construction project", "erection works", "civil construction"], weak: ["construction"] },
  { value: "Emergency Hiring", strong: ["emergency requirement", "emergency hiring", "breakdown maintenance", "crash mobilization"], weak: ["emergency"] },
  { value: "Replacement Hiring", strong: ["replacement of existing", "replacement hiring", "backfill", "demob replacement", "replacement staff"], weak: ["replacement"] },
];

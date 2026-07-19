/**
 * Creative Director Brain — shared types (Sprint 006, Phase A).
 *
 * The Brain is a collection of deterministic decision engines under one
 * orchestrator. Every engine:
 *   • is deterministic (no LLM, no randomness, no I/O),
 *   • has a single responsibility,
 *   • is independently testable (a pure exported function),
 *   • never invents facts (it only classifies / ranks / emphasizes grounded input),
 *   • explains WHY it decided (a `Trace`).
 *
 * The orchestrator assembles one immutable `CreativeDirection`. That object
 * is the ONLY input to the GPT Background Brief Generator, poster/layout
 * selection, typography, renderer, and Visual QA. The renderer never reasons.
 *
 * Tenant rule: agency/client/contact/data are runtime INPUT, never baked in.
 */

/** Every engine emits a trace so decisions are explainable end-to-end. */
export interface Trace {
  engine: string;
  decision: string;
  reason: string;
}

export interface EngineOutput<T> {
  value: T;
  trace: Trace;
}

// ─────────────────────────── grounded input ───────────────────────────

export type Channel =
  | "DTP_NEWSPAPER"
  | "SOCIAL_SQUARE"
  | "LINKEDIN_BANNER"
  | "WHATSAPP";

export interface CreativeInputPosition {
  title: string;
  count?: number;
  salary?: string | null;
}
export interface CreativeInputBenefit {
  label: string;
  detail?: string | null;
}
export interface CreativeInputInterview {
  date?: string | null;
  location?: string | null;
}

/**
 * Grounded, tenant-supplied facts — the sole input to the Brain. Mirrors the
 * app's AdvertisementFacts so a thin adapter can map it (Phase B). Kept local
 * so the Brain is decoupled and unit-testable in isolation.
 */
export interface CreativeInput {
  employer?: string | null;
  industry: string;
  country: string;
  header?: string | null;
  positions: CreativeInputPosition[];
  benefits: CreativeInputBenefit[];
  interview: CreativeInputInterview[];
  /** Free-text signals present in the source (e.g. "spot selection", "urgent"). */
  sourceSignals?: string[];
  agencyName: string;
  raLicenseId?: string | null;
  /** Agency Visual DNA palette (colours only, tenant identity). */
  agencyPalette?: { primary: string; secondary: string; accent: string } | null;
  channel?: Channel;
  aspectRatio?: number;
}

// ─────────────────────────── enums ───────────────────────────

export type Prominence = "LOW" | "MEDIUM" | "HIGH";
export type GccPrestige = "PRIME" | "HIGH" | "STABLE";
export type Currency = "SAR" | "AED" | "KWD" | "QAR" | "BHD" | "OMR" | "UNKNOWN";
export type BrandStrength = "MAGNET" | "CREDIBLE" | "UNKNOWN";

export type EmotionalTone =
  | "OPPORTUNITY" | "MODERN_CAREER" | "HIGH_INCOME" | "PREMIUM" | "STABLE"
  | "MONEY" | "PRESTIGE" | "URGENCY" | "CAREER" | "MEGA_PROJECT";

export type VisualStory =
  | "WORKER_HERO" | "TEAM" | "REFINERY" | "OFFSHORE_PLATFORM" | "CONSTRUCTION"
  | "ROYAL_PALACE" | "HOSPITAL" | "HOTEL" | "FACTORY" | "AIRPORT" | "METRO"
  | "MECHANICAL_CLOSEUP" | "SHIPYARD";

export type Personality =
  | "EXECUTIVE" | "CORPORATE" | "PREMIUM" | "MASS_HIRING" | "WALK_IN_DRIVE"
  | "SHUTDOWN" | "MEGA_PROJECT" | "URGENT_MOBILIZATION" | "LUXURY_HOSPITALITY"
  | "GOVERNMENT" | "HEALTHCARE";

export type LayoutFamily = "SINGLE_ROLE_BOX" | "DTP_GRID" | "MULTI_VACANCY_POSTER";
export type UrgencyLevel = "NONE" | "LOW" | "MEDIUM" | "HIGH";

export type OpportunityLever =
  | "COUNTRY" | "SALARY" | "INDUSTRY" | "PROJECT" | "EMPLOYER"
  | "POSITIONS" | "BENEFITS" | "INTERVIEW" | "TRUST";

// ─────────────────────────── engine decisions ───────────────────────────

export interface CountryDecision {
  country: string;
  prestige: GccPrestige;
  premiumColour: string; // descriptive, e.g. "Desert Gold"
  emotionalTone: EmotionalTone;
  flagKey: string; // e.g. "SA" — never fabricated imagery
}
export interface CurrencyDecision {
  currency: Currency;
  valid: boolean; // false → FAIL (wrong/undeterminable currency)
  format: string; // e.g. "SAR 12,000"
}
export interface EmployerDecision {
  brandStrength: BrandStrength;
  prominence: Prominence;
}
export interface IndustryDecision {
  attractiveness: number; // 0..100
  environment: string; // thematic scene seed (mood only)
  prominence: Prominence;
}
export interface SalaryDecision {
  hasSalary: boolean;
  overtimePresent: boolean;
  prominence: Prominence;
  vacancyCount: number;
  vacancyProminence: Prominence;
}
export interface BenefitsDecision {
  ranked: string[]; // grounded benefit labels, priority order
  primary: string | null;
  prominence: Prominence;
}
export interface ProjectDecision {
  projectType: string; // thematic descriptor only
  attractiveness: number;
  prominence: Prominence;
}
export interface UrgencyDecision {
  level: UrgencyLevel;
  driver: string | null; // e.g. "spot selection", "walk-in dates"
}
export interface PsychologyDecision {
  dominantHook: string;
  secondaryHook: string | null;
  motivation: EmotionalTone;
}
export interface OpportunityRankingDecision {
  ranked: OpportunityLever[];
  hero: OpportunityLever; // exactly one
  prominence: Record<"employer" | "country" | "industry" | "project", Prominence>;
}
export interface VisualStoryDecision {
  story: VisualStory;
  personality: Personality;
}
export interface HeroStrategyDecision {
  subject: string;
  placement: "RIGHT" | "LEFT" | "CENTER" | "NONE";
}
export interface BackgroundStrategyDecision {
  source: "GPT" | "DETERMINISTIC";
  sceneSeed: string;
}
export interface TypographyStrategyDecision {
  hero: string; secondary: string; table: string; cta: string;
}
export interface LayoutStrategyDecision {
  family: LayoutFamily;
  columns: number;
}
export interface ColourStrategyDecision {
  mood: string;
  dark: string; gold: string; // suggested tokens (agency DNA may adjust)
  agencyPaletteApplied: boolean;
}
export interface CtaStrategyDecision {
  priority: Prominence;
  kind: "WALK_IN" | "EMAIL" | "WHATSAPP" | "PHONE" | "MIXED";
}
export interface TrustStrategyDecision {
  order: string[]; // e.g. ["AGENCY_LOGO","MEA_RA","QR","SINCE_YEAR"]
  priority: Prominence;
}
export interface MobileStrategyDecision {
  mustSurvive: string[];
  mayShrink: string[];
}
export interface CommercialScore {
  scrollStop: number; commercialAppeal: number; candidatePsychology: number;
  informationHierarchy: number; colourHarmony: number; typography: number;
  trust: number; mobileReadability: number; brandQuality: number;
  publishReadiness: number;
  overall: number; // 0..100
  gate: "AUTO_APPROVE" | "CREATIVE_REVIEW" | "REJECT";
}
export interface TruthValidationDecision {
  pass: boolean;
  violations: string[];
  invented: "NONE";
}

// ─────────────────────────── final immutable output ───────────────────────────

export interface CreativeDirection {
  readonly country: CountryDecision;
  readonly currency: CurrencyDecision;
  readonly employer: EmployerDecision;
  readonly industry: IndustryDecision;
  readonly salary: SalaryDecision;
  readonly benefits: BenefitsDecision;
  readonly project: ProjectDecision;
  readonly urgency: UrgencyDecision;
  readonly psychology: PsychologyDecision;
  readonly opportunity: OpportunityRankingDecision;
  readonly visualStory: VisualStoryDecision;
  readonly hero: HeroStrategyDecision;
  readonly background: BackgroundStrategyDecision;
  readonly typography: TypographyStrategyDecision;
  readonly layout: LayoutStrategyDecision;
  readonly colour: ColourStrategyDecision;
  readonly cta: CtaStrategyDecision;
  readonly trust: TrustStrategyDecision;
  readonly mobile: MobileStrategyDecision;
  readonly commercialScore: CommercialScore;
  readonly truth: TruthValidationDecision;
  /** Per-engine explanations, in execution order. */
  readonly traceability: readonly Trace[];
}

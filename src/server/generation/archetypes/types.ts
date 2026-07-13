import type { PlatformFormat } from "@/lib/platform-formats";
import type { InterviewEvent } from "../interview-events";

/**
 * Two-Brain Architecture (Sprint 007).
 *
 * BRAIN A — TRUTH: `AdvertisementFacts` is the complete factual payload
 * of an advertisement. Every value in it must be source-grounded — it is
 * assembled by the generation service from the Advertisement record,
 * whose fields were extracted by the KAI Extraction Engine under
 * enforceSourceGrounding() (src/server/ai/openai/kai-extraction-engine.ts).
 * No composition engine may add, infer, or embellish a fact: if a field
 * is absent here, the corresponding block simply does not render.
 *
 * BRAIN B — CREATIVE: `CompositionPlan` is the presentation decision —
 * which archetype, which accent color, which decorative imagery, where
 * the verification QR sits. Creative freedom applies to everything in
 * the plan and nothing in the facts.
 */
export interface AdvertisementFacts {
  header: string;
  industry: string;
  country: string;
  employer?: string | null;
  positions: { title: string; count?: number; experience?: string }[];
  benefits: { label: string; detail?: string }[];
  interview: InterviewEvent[];
  contact: { name?: string; phone?: string; email?: string; whatsapp?: string };
  footer?: string | null;
  agencyName: string;
  /** Compact core RC number for constrained visual areas (Decision 1). */
  raLicenseId?: string | null;
  /** Full official registration string — printed verbatim in small print where the archetype's grammar calls for it (DTP references always show it at the very bottom). */
  fullRegistrationNumber?: string | null;
}

/**
 * The four genuinely distinct composition systems. These are NOT color
 * variants of one template — each has its own module with its own SVG
 * structure (see visual-hero.ts, structured-professional.ts,
 * high-density.ts, dtp-newspaper.ts).
 *
 * The persisted Prisma `AdvertisementStyle` enum (VISUAL / TYPOGRAPHY /
 * NEWSPAPER) is unchanged — archetype is a presentation-layer decision
 * derived from style + density by the Creative Brain
 * (archetype-selection.ts), so no database migration is required and
 * every existing advertisement record remains valid.
 */
export type AdvertisementArchetype =
  | "VISUAL_HERO"
  | "STRUCTURED_PROFESSIONAL"
  | "HIGH_DENSITY"
  | "DTP_NEWSPAPER";

/**
 * Bounded presentation corrections the acceptance loop may apply between
 * iterations (Brain C feedback → Brain B adjustment). Strictly layout-
 * level: no field here can touch a fact. Values are multipliers clamped
 * by the engines themselves, so a runaway correction loop cannot push a
 * composition into absurdity.
 */
export interface CompositionTuning {
  /** Multiplies headline starting font size (engines clamp to sane bounds). */
  headlineScale?: number;
  /** Multiplies section-gap/spread allocation in engines that distribute vertical space. */
  spacingScale?: number;
}

export interface CompositionPlan {
  archetype: AdvertisementArchetype;
  platformFormat: PlatformFormat;
  accentColor: string;
  /** KAI-generated verification QR (already self-decode-verified by qr-renderer.ts) as a data URI. Always points at the KAI-controlled /v/ route, never directly at MEA/eMigrate. */
  qrDataUri: string;
  backgroundImageDataUri?: string | null;
  agencyLogoDataUri?: string | null;
  tuning?: CompositionTuning;
  /** Agency Visual DNA (see visual-dna.ts) — tenant color/identity continuity. Color-level influence only; engines keep their own structure. */
  dna?: import("./visual-dna").AgencyVisualDna | null;
  /** Advertisement Intelligence copy plan (see advertisement-intelligence.ts) — grounded emphasis, never new facts. */
  copy?: import("./advertisement-intelligence").AdCopyPlan | null;
}

export interface CompositionInput {
  facts: AdvertisementFacts;
  plan: CompositionPlan;
}

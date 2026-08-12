import type { AgencyDNA } from "../dna/agency-dna";
import type { RegionIntelligence } from "../dna/region-intelligence";
import { getDna, hasDna, selectDna, type DnaSelection } from "../dna/registry";
import type { DnaPack } from "../dna/design-dna";
import type { FooterStyle } from "./footer-styles";
import type { AdInk, AdvertisementFacts } from "./types";

/**
 * The Advertisement JSON — the single internal representation of an
 * advertisement.
 *
 * Everything KAI knows about an advertisement lives here as structured
 * data: the verified facts, which Design DNA dresses them, which agency
 * owns it, what format it is being produced at, and where its background
 * artwork came from. The Rendering Engine's only job is to convert this
 * document into pixels.
 *
 * Three consequences follow, and they are the reason the document exists:
 *
 *  1. **Editing never edits pixels.** An edit is a change to this JSON,
 *     after which the renderer runs again. There is no path that modifies
 *     a rendered image, because a rendered image is an output, not a
 *     source.
 *
 *  2. **Editing never calls AI.** The background artwork is referenced by
 *     `artwork.assetRef`, so a re-render reuses the artwork that was
 *     already generated. Changing a salary does not summon an image model.
 *
 *  3. **A re-render is reproducible.** Given the same document and the
 *     same artwork, the renderer produces the same advertisement. Design
 *     DNA selection is resolved once, at creation, and then persisted —
 *     so a recruiter who reloads never gets a different poster.
 */

export const ADVERTISEMENT_DOCUMENT_SCHEMA_VERSION = 1;

export interface DocumentFormat {
  /** Platform format key from src/lib/platform-formats.ts, when one applies. */
  key: string | null;
  widthPx: number;
  heightPx: number;
  /** Output resolution. Required for print so the legibility floor is physical. */
  dpi: number | null;
  /** Explicit print / newspaper destination — forces the classified composition. */
  printOrNewspaper: boolean;
}

export interface DocumentDesign {
  /** The chosen Design DNA. Resolved once and then persisted. */
  dnaId: string;
  /** Why it was chosen — surfaced to the recruiter and analytics. */
  dnaReason: string;
  /** True when the recruiter picked the DNA rather than KAI selecting it. */
  dnaFromOverride: boolean;
  /** Agency's trust-strip dress. Null means KAI picks per advertisement. */
  footerStyle: FooterStyle | null;
  ink: AdInk;
}

export interface DocumentArtwork {
  /**
   * AI_GENERATED — a background exists and was produced by the image model.
   * NONE — the composition prints no photography (the classified languages),
   * or artwork has not been generated yet.
   */
  source: "AI_GENERATED" | "NONE";
  /**
   * The brief that produced the artwork, kept verbatim so an operator can
   * see exactly what the image model was asked for.
   */
  brief: string | null;
  /**
   * Opaque reference to the stored background PNG. The Editing Engine
   * passes it back so a re-render reuses the same artwork instead of
   * generating new artwork for a text change.
   */
  assetRef: string | null;
}

export interface AdvertisementDocument {
  schemaVersion: number;
  advertisementId: string;
  /** Increments on every edit. The renderer never changes it. */
  revision: number;
  /** Every verified recruitment fact. Source-grounded; never inferred. */
  facts: AdvertisementFacts;
  design: DocumentDesign;
  /** The agency's permanent identity, resolved from the verified profile. */
  agency: AgencyDNA;
  format: DocumentFormat;
  artwork: DocumentArtwork;
  /** Objective recruitment intelligence. Never a claim on the advertisement. */
  region: RegionIntelligence | null;
  updatedAt: string;
}

export interface BuildDocumentInput {
  advertisementId: string;
  facts: AdvertisementFacts;
  agency: AgencyDNA;
  format: DocumentFormat;
  region?: RegionIntelligence | null;
  ink?: AdInk;
  /** Recruiter's explicit DNA choice. */
  preferredDnaId?: string | null;
  /** Recruiter's pack preference when they have not picked a single DNA. */
  preferredPack?: DnaPack | null;
  /** Footer style override; defaults to the agency's saved preference. */
  footerStyle?: FooterStyle | null;
}

/**
 * Creates the document for a new advertisement. This is the ONLY place a
 * Design DNA is selected: after this point the choice is data on the
 * document, so every later render and every edit reproduces it exactly.
 */
export function buildAdvertisementDocument(input: BuildDocumentInput): AdvertisementDocument {
  const selection: DnaSelection = selectDna({
    industry: input.facts.industry,
    country: input.facts.country,
    positionCount: input.facts.positions.length,
    printOrNewspaper: input.format.printOrNewspaper,
    preferredDnaId: input.preferredDnaId ?? null,
    preferredPack: input.preferredPack ?? null,
    seed: input.advertisementId,
  });

  return {
    schemaVersion: ADVERTISEMENT_DOCUMENT_SCHEMA_VERSION,
    advertisementId: input.advertisementId,
    revision: 1,
    facts: input.facts,
    design: {
      dnaId: selection.dna.id,
      dnaReason: selection.reason,
      dnaFromOverride: selection.fromOverride,
      footerStyle: input.footerStyle ?? input.agency.footerStyle ?? null,
      ink: input.ink ?? "COLOUR",
    },
    agency: input.agency,
    format: input.format,
    artwork: { source: "NONE", brief: null, assetRef: null },
    region: input.region ?? null,
    updatedAt: new Date().toISOString(),
  };
}

/** The resolved Design DNA for a document. Throws if the DNA was removed. */
export function documentDna(document: AdvertisementDocument) {
  return getDna(document.design.dnaId);
}

export class DocumentSchemaError extends Error {
  constructor(readonly problems: string[]) {
    super(`Advertisement JSON is invalid:\n  - ${problems.join("\n  - ")}`);
    this.name = "DocumentSchemaError";
  }
}

/**
 * Parses a persisted document back into a typed one.
 *
 * A document is durable state — it outlives the process that wrote it, and
 * it is what an edit six months later is applied to. So it is validated on
 * the way in rather than trusted: a document referencing a DNA that no
 * longer exists, or missing the facts it claims to render, must fail here
 * where the error is legible, not deep inside the renderer.
 */
export function parseAdvertisementDocument(value: unknown): AdvertisementDocument {
  const problems: string[] = [];
  if (!value || typeof value !== "object") throw new DocumentSchemaError(["document is not an object"]);
  const d = value as Partial<AdvertisementDocument>;

  if (typeof d.schemaVersion !== "number") problems.push("schemaVersion is missing");
  else if (d.schemaVersion > ADVERTISEMENT_DOCUMENT_SCHEMA_VERSION) {
    problems.push(
      `schemaVersion ${d.schemaVersion} is newer than this build understands ` +
        `(${ADVERTISEMENT_DOCUMENT_SCHEMA_VERSION}) — refusing to render it rather than guessing`,
    );
  }
  if (typeof d.advertisementId !== "string" || !d.advertisementId) problems.push("advertisementId is missing");
  if (typeof d.revision !== "number" || d.revision < 1) problems.push("revision must be a positive number");
  if (!d.facts || typeof d.facts !== "object") problems.push("facts are missing");
  else {
    if (!Array.isArray(d.facts.positions)) problems.push("facts.positions must be an array");
    if (!Array.isArray(d.facts.benefits)) problems.push("facts.benefits must be an array");
    if (!Array.isArray(d.facts.interview)) problems.push("facts.interview must be an array");
    if (typeof d.facts.agencyName !== "string") problems.push("facts.agencyName is missing");
  }
  if (!d.design || typeof d.design !== "object") problems.push("design is missing");
  else if (typeof d.design.dnaId !== "string" || !hasDna(d.design.dnaId)) {
    problems.push(`design.dnaId "${d.design?.dnaId}" is not in the Design DNA library`);
  }
  if (!d.agency || typeof d.agency !== "object") problems.push("agency is missing");
  if (!d.format || typeof d.format !== "object") problems.push("format is missing");
  else {
    if (typeof d.format.widthPx !== "number" || d.format.widthPx <= 0) problems.push("format.widthPx must be positive");
    if (typeof d.format.heightPx !== "number" || d.format.heightPx <= 0) problems.push("format.heightPx must be positive");
  }
  if (!d.artwork || typeof d.artwork !== "object") problems.push("artwork is missing");

  if (problems.length > 0) throw new DocumentSchemaError(problems);
  return value as AdvertisementDocument;
}

/** Serialises for persistence. Plain JSON — no classes, no functions, no cycles. */
export function serialiseAdvertisementDocument(document: AdvertisementDocument): string {
  return JSON.stringify(document);
}

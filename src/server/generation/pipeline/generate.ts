import { buildCreativeBrief } from "./creative-brief";
import { renderFactLayer, type AdTheme, type ThemeSelection } from "./fact-layer";
import { selectFooterStyle } from "./footer-selection";
import type { FooterStyle } from "./footer-styles";
import { applyBrandingOverlay } from "./branding-overlay";
import { runVisionQa, VisionQaRejectedError, type VisionQaResult } from "./vision-qa";
import {
  buildAdvertisementDocument,
  documentDna,
  type AdvertisementDocument,
} from "./advertisement-document";
import { agencyAddressLine, agencyContactLine, applyAgencyBrand } from "../dna/agency-dna";
import { getImageGenerationProvider } from "@/server/ai/image";
import sharp from "sharp";
import { getEnv } from "@/lib/env";
import type { AdInk, AdvertisementFacts } from "./types";

/**
 * The one production advertisement pipeline.
 *
 *   Advertisement JSON
 *     -> Creative Brief (one text call, BACKGROUND ARTWORK ONLY)
 *     -> one image call
 *     -> Rendering Engine (every verified fact, typeset deterministically)
 *     -> Vision QA
 *     -> return
 *
 * `renderAdvertisement` is the half that turns a document into pixels. It
 * makes no network calls and invokes no model, which is what lets the
 * Editing Engine re-render an edited document instantly, offline, and
 * without an image model touching an advertisement whose salary a
 * recruiter just corrected.
 */

/** Binary assets that live outside the document because they are not JSON. */
export interface RenderAssets {
  /** The background artwork. Null renders the facts on the DNA's surfaces. */
  backgroundPng?: Buffer | null;
  agencyLogoPng?: Buffer | null;
  qrPng?: Buffer | null;
}

export interface RenderResult {
  imagePng: Buffer;
  /** Which footer was used and why — surfaced to the recruiter and analytics. */
  footerSelection: Awaited<ReturnType<typeof selectFooterStyle>>;
  /** Which design language was used, and why. */
  themeSelection: ThemeSelection;
  /** Notes on which agency brand colours were applied, and which declined. */
  brandNotes: string[];
}

/**
 * Renders an Advertisement JSON into a finished advertisement.
 *
 * Deterministic and AI-free. Same document plus same artwork always yields
 * the same pixels, which is the property the Editing Engine is built on.
 */
export async function renderAdvertisement(
  document: AdvertisementDocument,
  assets: RenderAssets = {},
): Promise<RenderResult> {
  const dna = documentDna(document);
  const { palette, notes } = applyAgencyBrand(dna, document.agency);
  const { facts, format } = document;

  // Factual Integrity Law (docs/010 Amendment 1): the model supplies
  // artwork only. Every verified fact is typeset deterministically here,
  // over the artwork and beneath the branding band.
  // The canvas may grow taller than requested so that a large requirement
  // stays legible — text is never shrunk below KDL's floor to force a fit.
  const factLayer = await renderFactLayer({
    facts,
    widthPx: format.widthPx,
    heightPx: format.heightPx,
    dna,
    palette,
    printOrNewspaper: format.printOrNewspaper,
    dpi: format.dpi ?? undefined,
    ink: document.design.ink,
  });
  const canvasHeight = factLayer.heightPx;

  const base = assets.backgroundPng
    ? sharp(assets.backgroundPng).resize(format.widthPx, canvasHeight, { fit: "cover" })
    : sharp({
        create: {
          width: format.widthPx,
          height: canvasHeight,
          channels: 4,
          background: palette.surface,
        },
      });
  const imagePng = await base
    .composite([{ input: factLayer.png, left: 0, top: 0 }])
    .png()
    .toBuffer();

  // Branding compatibility only: this reads the artwork to choose a
  // footer and never modifies it.
  const footerSelection = await selectFooterStyle(imagePng, document.design.footerStyle);

  const finalPng = await applyBrandingOverlay({
    imagePng,
    widthPx: format.widthPx,
    heightPx: canvasHeight,
    agencyLogoPng: assets.agencyLogoPng,
    qrPng: assets.qrPng,
    agencyName: document.agency.name,
    registrationNumber: document.agency.registrationNumber,
    contactLine: agencyContactLine(document.agency, facts.contact),
    addressLine: agencyAddressLine(document.agency),
    footerStyle: footerSelection.style,
    brandBadges: document.agency.badges,
    artworkHeightPx: factLayer.artworkHeightPx,
    singleInk: document.design.ink === "SINGLE_INK",
  });

  return {
    imagePng: finalPng,
    footerSelection,
    themeSelection: factLayer.themeSelection,
    brandNotes: notes,
  };
}

export interface GeneratePipelineInput {
  /**
   * The Advertisement JSON. When omitted one is built from the flat fields
   * below — the same document, assembled here instead of by the caller, so
   * that scripts and older callers still go through exactly this pipeline.
   */
  document?: AdvertisementDocument;
  facts: AdvertisementFacts;
  widthPx: number;
  heightPx: number;
  style?: string;
  theme?: string;
  agencyLogoPng?: Buffer | null;
  qrPng?: Buffer | null;
  agencyName?: string | null;
  registrationNumber?: string | null;
  contactLine?: string | null;
  /** Agency address/website line for the branding band. */
  addressLine?: string | null;
  /** Agency's saved footer preference; when absent KAI selects one. */
  footerStyle?: FooterStyle | null;
  brandBadges?: string[] | null;
  /** Recruiter override of the design language. Omitted means KAI selects it. */
  designTheme?: AdTheme | null;
  /** Explicit print / newspaper destination — forces the AAT/DTP language. */
  printOrNewspaper?: boolean;
  /** Output resolution; required for print so the type floor is physical. */
  dpi?: number;
  /** Ink: single-ink is one black plate, the way a newspaper prints. */
  ink?: AdInk;
}

export interface GeneratePipelineResult {
  imagePng: Buffer;
  brief: string;
  usage: { model: string; latencyMs: number; estimatedCostUsd: number | null };
  footerSelection: Awaited<ReturnType<typeof selectFooterStyle>>;
  /** Final gate: every verified fact read back off the rendered pixels. */
  visionQa: VisionQaResult;
  themeSelection: ThemeSelection;
  /**
   * The document that produced this advertisement, with the artwork brief
   * recorded on it. Persist this: it is what the Editing Engine edits and
   * what a later re-render reproduces the advertisement from.
   */
  document: AdvertisementDocument;
  /** The background artwork, so an edit can re-render without a new image call. */
  backgroundPng: Buffer;
}

export async function generateAdvertisement(input: GeneratePipelineInput): Promise<GeneratePipelineResult> {
  const document = input.document ?? documentFromLegacyInput(input);
  const brief = await buildCreativeBrief(document.facts, { style: input.style, theme: input.theme });

  const provider = getImageGenerationProvider();
  const { output, usage } = await provider.generate({
    prompt: brief,
    widthPx: document.format.widthPx,
    heightPx: document.format.heightPx,
    quality: getEnv().KAI_IMAGE_QUALITY,
  });
  const backgroundPng = Buffer.from(output.imageBase64, "base64");

  const rendered = await renderAdvertisement(document, {
    backgroundPng,
    agencyLogoPng: input.agencyLogoPng,
    qrPng: input.qrPng,
  });

  // Final gate. The advertisement is verified against its own pixels
  // before it can be returned, and a mismatch rejects it outright — KAI
  // never silently corrects a rendered advertisement, because the
  // corrected version would say something the recruiter never wrote.
  const visionQa = await runVisionQa({ imagePng: rendered.imagePng, facts: document.facts, document });
  if (!visionQa.passed) throw new VisionQaRejectedError(visionQa);

  return {
    imagePng: rendered.imagePng,
    brief,
    usage,
    footerSelection: rendered.footerSelection,
    visionQa,
    themeSelection: rendered.themeSelection,
    document: { ...document, artwork: { source: "AI_GENERATED", brief, assetRef: document.artwork.assetRef } },
    backgroundPng,
  };
}

/**
 * Builds the document for a caller that has not adopted the JSON model yet.
 * Not a second pipeline — the SAME document type, assembled from flat
 * arguments, so every caller converges on one representation immediately
 * after this line.
 */
function documentFromLegacyInput(input: GeneratePipelineInput): AdvertisementDocument {
  return buildAdvertisementDocument({
    advertisementId: `legacy:${input.facts.agencyName}:${input.facts.header}`,
    facts: input.facts,
    agency: {
      agencyId: "legacy",
      name: input.agencyName ?? input.facts.agencyName,
      registrationNumber: input.registrationNumber ?? input.facts.fullRegistrationNumber ?? "",
      compactRegistrationId: input.facts.raLicenseId ?? null,
      logoUrl: null,
      secondaryLogoUrl: null,
      badges: input.brandBadges ?? [],
      footerStyle: input.footerStyle ?? null,
      contact: {
        phone: input.facts.contact.phone ?? null,
        whatsapp: input.facts.contact.whatsapp ?? null,
        email: input.facts.contact.email ?? null,
        website: input.facts.website ?? null,
        officeAddress: input.facts.officeAddress ?? null,
      },
      brand: { primary: null, secondary: null },
    },
    format: {
      key: null,
      widthPx: input.widthPx,
      heightPx: input.heightPx,
      dpi: input.dpi ?? null,
      printOrNewspaper: Boolean(input.printOrNewspaper),
    },
    ink: input.ink,
    footerStyle: input.footerStyle ?? null,
  });
}

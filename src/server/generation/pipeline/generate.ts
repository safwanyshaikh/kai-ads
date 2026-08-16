import { buildCreativeBrief } from "./creative-brief";
import { selectFooterStyle } from "./footer-selection";
import type { FooterStyle } from "./footer-styles";
import { applyBrandingOverlay } from "./branding-overlay";
import { renderFactLayer } from "./fact-layer";
import { getImageGenerationProvider } from "@/server/ai/image";
import sharp from "sharp";
import { getEnv } from "@/lib/env";
import type {
  AdvertisementFacts,
  AdvertisementCampaignContact,
  VerifiedAgencyProfile,
} from "./types";

export interface GeneratePipelineInput {
  facts: AdvertisementFacts;

  widthPx: number;
  heightPx: number;

  style?: string;
  theme?: string;

  /**
   * ------------------------------------------------------------------------
   * VERIFIED AGENCY TRUST ASSETS
   * ------------------------------------------------------------------------
   *
   * These are NOT campaign content.
   *
   * They belong to the agency profile and must be verified before production
   * publishing.
   */
  agencyLogoPng?: Buffer | null;

  qrPng?: Buffer | null;

  agencyProfile?: VerifiedAgencyProfile | null;

  /**
   * Legacy compatibility.
   *
   * These values are still accepted by older callers.
   * Canonical agencyProfile values take precedence.
   */
  agencyName?: string | null;
  registrationNumber?: string | null;

  /**
   * ------------------------------------------------------------------------
   * CAMPAIGN CONTACT
   * ------------------------------------------------------------------------
   *
   * Candidate-facing contact for THIS advertisement.
   *
   * This is intentionally separate from:
   *
   * agencyProfile.officialPhone
   * agencyProfile.officialEmail
   */
  campaignContact?:
    | AdvertisementCampaignContact
    | null;

  /**
   * Legacy campaign contact compatibility.
   */
  contactLine?: string | null;

  /**
   * ------------------------------------------------------------------------
   * AGENCY REGISTERED ADDRESS
   * ------------------------------------------------------------------------
   *
   * This is the official registered office address.
   *
   * It is NOT the interview venue.
   *
   * Canonical source:
   *
   * agencyProfile.registeredAddress
   */
  addressLine?: string | null;

  /**
   * Legacy agency verification/profile assets.
   */
  footerStyle?: FooterStyle | null;

  brandBadges?: string[] | null;
}

export interface GeneratePipelineResult {
  imagePng: Buffer;

  /**
   * The FINAL rendered height, in pixels — may be taller than
   * input.heightPx when the fact layer grew the canvas for a dense
   * requirement. Callers (Visual QA, cost tracking, persistence) must use
   * this, not the originally requested heightPx, when describing the
   * actual delivered image.
   */
  heightPx: number;

  brief: string;

  usage: {
    model: string;
    latencyMs: number;
    estimatedCostUsd:
      | number
      | null;
  };

  footerSelection: Awaited<
    ReturnType<
      typeof selectFooterStyle
    >
  >;
}

/**
 * ============================================================================
 * KAI ADS — PRODUCTION CREATIVE PIPELINE
 * ============================================================================
 *
 * SOURCE REQUIREMENT
 *        ↓
 * KAI RECRUITMENT INTELLIGENCE
 *        ↓
 * CAMPAIGN CREATIVE BRIEF
 *        ↓
 * GEMINI BACKGROUND ARTWORK
 *        ↓
 * KAI DETERMINISTIC FACT LAYER
 *        ↓
 * KAI VERIFIED TRUST LAYER
 *        ↓
 * VISUAL QA
 *        ↓
 * FINAL ADVERTISEMENT
 *
 * ----------------------------------------------------------------------------
 *
 * RESTORED (commercial readiness audit, Step 1 — fact-layer.ts):
 *
 * Gemini is background/visual artwork ONLY. It is never the source of
 * truth for recruitment text. Every verified fact — campaign headline,
 * country, industry, project/employer, exact position names, exact
 * vacancy counts, salary, benefits, interview, campaign contact, and any
 * source-supplied footer note — is typeset deterministically by
 * `fact-layer.ts`, over the Gemini artwork, beneath the KAI trust layer.
 *
 * GEMINI OWNS:
 *
 *   - hero photography / environment / workers / machinery
 *   - lighting, atmosphere, visual composition
 *   - decorative visual elements only
 *
 * KAI OWNS:
 *
 *   - campaign headline, country, industry, project/employer
 *   - exact positions and exact vacancy counts
 *   - salary, benefits, interview, campaign contact (when present)
 *   - verified agency identity
 *   - exact approved agency logo
 *   - exact RC / registration
 *   - exact approved agency information
 *   - exact verification QR
 *
 * Gemini's own output must contain NO readable recruitment text — see
 * creative-brief.ts (not changed in this step; still asks Gemini to
 * compose full advertisement text, so its output currently still
 * duplicates what the fact layer now draws — tracked as a follow-up,
 * not part of this port).
 * ============================================================================
 */
export async function generateAdvertisement(
  input: GeneratePipelineInput,
): Promise<GeneratePipelineResult> {
  /**
   * ------------------------------------------------------------------------
   * STEP 1 — NORMALISE AGENCY PROFILE
   * ------------------------------------------------------------------------
   *
   * Agency identity must come from one canonical object.
   *
   * Legacy callers are still supported during migration.
   */
  const agencyProfile =
    resolveAgencyProfile(
      input,
    );

  /**
   * ------------------------------------------------------------------------
   * STEP 2 — NORMALISE CAMPAIGN CONTACT
   * ------------------------------------------------------------------------
   *
   * The campaign contact is NOT the agency profile.
   */
  const campaignContact =
    resolveCampaignContact(
      input,
    );

  /**
   * ------------------------------------------------------------------------
   * STEP 3 — BUILD COMPLETE CREATIVE BRIEF
   * ------------------------------------------------------------------------
   *
   * KAI decides WHAT must be communicated.
   *
   * Gemini decides HOW the advertisement looks.
   */
  const brief =
    await buildCreativeBrief(
      input.facts,
      {
        style:
          input.style,
        theme:
          input.theme,
      },
    );

  /**
   * ------------------------------------------------------------------------
   * STEP 4 — GEMINI COMPLETE ADVERTISEMENT
   * ------------------------------------------------------------------------
   */
  const provider =
    getImageGenerationProvider();

  const {
    output,
    usage,
  } =
    await provider.generate({
      prompt:
        brief,

      widthPx:
        input.widthPx,

      heightPx:
        input.heightPx,

      quality:
        getEnv()
          .KAI_IMAGE_QUALITY,
    });

  const aiArtwork =
    Buffer.from(
      output.imageBase64,
      "base64",
    );

  /**
   * ------------------------------------------------------------------------
   * STEP 5 — NORMALISE DIMENSIONS WITHOUT CROPPING
   * ------------------------------------------------------------------------
   *
   * Preserve Gemini's entire composition.
   *
   * Never use "cover".
   * Never crop the worker.
   * Never crop the hero.
   * Never crop generated recruitment content.
   */
  const normalizedArtwork =
    await fitWithoutCropping(
      aiArtwork,
      input.widthPx,
      input.heightPx,
    );

  /**
   * ------------------------------------------------------------------------
   * STEP 5.5 — KAI DETERMINISTIC FACT LAYER
   * ------------------------------------------------------------------------
   *
   * Typesets every verified recruitment fact over the Gemini artwork.
   * Text never shrinks below the legibility floor — when a requirement is
   * large the CANVAS GROWS (factLayer.heightPx) rather than the type
   * shrinking, so the artwork's canvas is EXTENDED to the grown height
   * (the fact layer, not Gemini, decides final canvas height). Extended,
   * never resized-to-cover: a "cover" resize scales the whole frame up and
   * crops the sides to fill the new height, which measurably cropped ~11%
   * off each edge of the real hero photograph on a dense requirement —
   * exactly what fitWithoutCropping above exists to prevent. Extending
   * only adds new canvas below the existing artwork; not one pixel of
   * Gemini's frame is scaled or cropped.
   */
  const factLayer =
    await renderFactLayer({
      facts: input.facts,
      widthPx: input.widthPx,
      heightPx: input.heightPx,
    });

  const canvasHeightPx =
    factLayer.heightPx;

  const artworkForCanvas =
    canvasHeightPx > input.heightPx
      ? await extendCanvasHeight(normalizedArtwork, input.widthPx, canvasHeightPx)
      : normalizedArtwork;

  const imageWithFacts =
    await sharp(artworkForCanvas)
      .composite([{ input: factLayer.png, left: 0, top: 0 }])
      .png()
      .toBuffer();

  /**
   * ------------------------------------------------------------------------
   * STEP 6 — SELECT TRUST FOOTER TREATMENT
   * ------------------------------------------------------------------------
   *
   * Reads the composited artwork (background + facts) to choose a footer
   * treatment; never modifies it.
   */
  const footerSelection =
    await selectFooterStyle(
      imageWithFacts,
      input.footerStyle,
    );

  /**
   * ------------------------------------------------------------------------
   * STEP 7 — KAI TRUST LAYER ONLY
   * ------------------------------------------------------------------------
   *
   * Deterministic information allowed here:
   *
   *   ✓ approved agency logo
   *   ✓ exact agency name
   *   ✓ exact registration
   *   ✓ official registered address
   *   ✓ campaign contact where supplied
   *   ✓ exact QR
   *
   * Never:
   *
   *   ✗ job list
   *   ✗ vacancy table
   *   ✗ salary
   *   ✗ benefits
   *   ✗ interview panel
   *   ✗ campaign headline
   *   ✗ recruitment body
   */
  const finalPng =
    await applyBrandingOverlay({
      imagePng:
        imageWithFacts,

      widthPx:
        input.widthPx,

      heightPx:
        canvasHeightPx,

      /**
       * Facts remain available for compatibility and
       * downstream validation, but the branding layer
       * MUST NOT use them to rebuild the ad body.
       */
      facts:
        input.facts,

      agencyLogoPng:
        input.agencyLogoPng,

      qrPng:
        input.qrPng,

      /**
       * Canonical agency identity.
       */
      agencyName:
        agencyProfile.agencyName,

      registrationNumber:
        agencyProfile.fullRegistrationNumber ??
        agencyProfile.rcNumber,

      /**
       * Campaign-facing contact is kept separate from
       * the agency's permanent official contact.
       *
       * Prefer campaign email/phone, then legacy
       * contactLine.
       */
      contactLine:
        buildCampaignContactLine(
          campaignContact,
          input.contactLine,
        ),

      /**
       * IMPORTANT:
       *
       * This is the REGISTERED ADDRESS.
       *
       * It is never taken from interviewVenue.
       */
      addressLine:
        agencyProfile.registeredAddress ??
        input.addressLine ??
        null,

      footerStyle:
        footerSelection.style,

      brandBadges:
        agencyProfile.approvedBadges ??
        input.brandBadges,
    });

  return {
    imagePng:
      finalPng,

    heightPx:
      canvasHeightPx,

    brief,

    usage,

    footerSelection,
  };
}

/* ========================================================================== */
/* NORMALISATION                                                               */
/* ========================================================================== */

/**
 * Resolve the one canonical agency profile.
 *
 * New callers:
 *   input.agencyProfile
 *
 * Legacy callers:
 *   input.agencyName
 *   input.registrationNumber
 *   input.addressLine
 */
function resolveAgencyProfile(
  input: GeneratePipelineInput,
): VerifiedAgencyProfile {
  const supplied =
    input.agencyProfile;

  if (supplied) {
    return supplied;
  }

  return {
    agencyName:
      input.agencyName ??
      input.facts.agencyProfile
        ?.agencyName ??
      input.facts.agencyName,

    logoUrl:
      input.facts.agencyProfile
        ?.logoUrl ??
      null,

    rcNumber:
      input.facts.agencyProfile
        ?.rcNumber ??
      input.registrationNumber ??
      input.facts.raLicenseId ??
      null,

    fullRegistrationNumber:
      input.facts.agencyProfile
        ?.fullRegistrationNumber ??
      input.registrationNumber ??
      input.facts.fullRegistrationNumber ??
      null,

    meaRegistrationText:
      input.facts.agencyProfile
        ?.meaRegistrationText ??
      null,

    isoCertification:
      input.facts.agencyProfile
        ?.isoCertification ??
      null,

    isoLogoUrl:
      input.facts.agencyProfile
        ?.isoLogoUrl ??
      null,

    registeredAddress:
      input.facts.agencyProfile
        ?.registeredAddress ??
      input.addressLine ??
      input.facts.officeAddress ??
      null,

    officialPhone:
      input.facts.agencyProfile
        ?.officialPhone ??
      null,

    officialEmail:
      input.facts.agencyProfile
        ?.officialEmail ??
      null,

    website:
      input.facts.agencyProfile
        ?.website ??
      input.facts.website ??
      null,

    verificationStatus:
      input.facts.agencyProfile
        ?.verificationStatus ??
      "UNVERIFIED",

    verificationId:
      input.facts.agencyProfile
        ?.verificationId ??
      null,

    verificationUrl:
      input.facts.agencyProfile
        ?.verificationUrl ??
      null,

    approvedBadges:
      input.facts.agencyProfile
        ?.approvedBadges ??
      [],
  };
}

/**
 * Campaign contact resolver.
 *
 * Priority:
 *
 * 1. Explicit campaignContact
 * 2. AdvertisementFacts.contact
 * 3. Legacy contactLine
 */
function resolveCampaignContact(
  input: GeneratePipelineInput,
): AdvertisementCampaignContact {
  if (
    input.campaignContact
  ) {
    return {
      name:
        cleanOptional(
          input.campaignContact
            .name,
        ),

      phone:
        cleanOptional(
          input.campaignContact
            .phone,
        ),

      email:
        cleanOptional(
          input.campaignContact
            .email,
        ),

      whatsapp:
        cleanOptional(
          input.campaignContact
            .whatsapp,
        ),
    };
  }

  return {
    name:
      cleanOptional(
        input.facts.contact
          .name,
      ),

    phone:
      cleanOptional(
        input.facts.contact
          .phone,
      ),

    email:
      cleanOptional(
        input.facts.contact
          .email,
      ),

    whatsapp:
      cleanOptional(
        input.facts.contact
          .whatsapp,
      ),
  };
}

function buildCampaignContactLine(
  contact:
    | AdvertisementCampaignContact
    | null,
  legacyLine:
    | string
    | null
    | undefined,
): string | null {
  if (!contact) {
    return (
      cleanOptional(
        legacyLine,
      ) ?? null
    );
  }

  const parts =
    [
      contact.name,
      contact.phone,
      contact.email,
      contact.whatsapp,
    ].filter(
      (
        value,
      ): value is string =>
        Boolean(
          value?.trim(),
        ),
    );

  if (
    parts.length > 0
  ) {
    return parts.join(
      "  •  ",
    );
  }

  return (
    cleanOptional(
      legacyLine,
    ) ?? null
  );
}

function cleanOptional(
  value:
    | string
    | null
    | undefined,
): string | undefined {
  const cleaned =
    value?.trim();

  return cleaned ||
    undefined;
}

/**
 * Grows the artwork's canvas to a taller height WITHOUT cropping or
 * rescaling a single pixel of it — the fact layer decided it needs more
 * room than the requested canvas; the artwork must not pay for that with
 * a cropped hero. The new region is added below the existing frame,
 * filled with a colour sampled from the artwork's own bottom edge so the
 * seam reads as a continuation rather than a hard cut. That region sits
 * almost entirely beneath the identity panel (see fact-layer.ts's
 * canvas-height solve), so exact texture there matters far less than
 * never touching the photograph itself.
 */
export async function extendCanvasHeight(
  image: Buffer,
  widthPx: number,
  targetHeightPx: number,
): Promise<Buffer> {
  const metadata = await sharp(image).metadata();
  const sourceHeight = metadata.height ?? targetHeightPx;
  const extra = targetHeightPx - sourceHeight;
  if (extra <= 0) return image;

  const { data } = await sharp(image)
    .extract({ left: 0, top: Math.max(0, sourceHeight - 1), width: widthPx, height: 1 })
    .resize(1, 1, { fit: "cover" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const r = data[0] ?? 20;
  const g = data[1] ?? 20;
  const b = data[2] ?? 20;

  return sharp(image)
    .extend({ bottom: extra, background: { r, g, b } })
    .png()
    .toBuffer();
}

/* ========================================================================== */
/* IMAGE NORMALISATION                                                         */
/* ========================================================================== */

/**
 * Preserve the complete Gemini composition.
 *
 * Gemini image:
 *       ↓
 * complete image preserved
 *       ↓
 * publication dimensions
 *
 * Never:
 *
 * Gemini image
 *       ↓
 * destructive crop
 */
async function fitWithoutCropping(
  image: Buffer,
  widthPx: number,
  heightPx: number,
): Promise<Buffer> {
  const metadata =
    await sharp(
      image,
    ).metadata();

  const sourceWidth =
    metadata.width ??
    widthPx;

  const sourceHeight =
    metadata.height ??
    heightPx;

  const scale =
    Math.min(
      widthPx /
        sourceWidth,

      heightPx /
        sourceHeight,
    );

  const fittedWidth =
    Math.max(
      1,
      Math.round(
        sourceWidth *
          scale,
      ),
    );

  const fittedHeight =
    Math.max(
      1,
      Math.round(
        sourceHeight *
          scale,
      ),
    );

  /**
   * Exact match.
   */
  if (
    fittedWidth ===
      widthPx &&
    fittedHeight ===
      heightPx
  ) {
    return sharp(
      image,
    )
      .resize(
        widthPx,
        heightPx,
        {
          fit: "inside",
          withoutEnlargement:
            false,
        },
      )
      .png()
      .toBuffer();
  }

  /**
   * Resize the entire image.
   */
  const fitted =
    await sharp(
      image,
    )
      .resize(
        fittedWidth,
        fittedHeight,
        {
          fit: "inside",
          withoutEnlargement:
            false,
        },
      )
      .png()
      .toBuffer();

  /**
   * Extract a representative colour for the tiny
   * unavoidable extension.
   */
  const {
    data,
  } =
    await sharp(
      fitted,
    )
      .resize(
        1,
        1,
        {
          fit: "cover",
        },
      )
      .removeAlpha()
      .raw()
      .toBuffer({
        resolveWithObject:
          true,
      });

  const r =
    data[0] ?? 20;

  const g =
    data[1] ?? 20;

  const b =
    data[2] ?? 20;

  return sharp({
    create: {
      width:
        widthPx,

      height:
        heightPx,

      channels: 3,

      background: {
        r,
        g,
        b,
      },
    },
  })
    .composite([
      {
        input:
          fitted,

        left:
          Math.round(
            (
              widthPx -
              fittedWidth
            ) / 2,
          ),

        top:
          Math.round(
            (
              heightPx -
              fittedHeight
            ) / 2,
          ),
      },
    ])
    .png()
    .toBuffer();
}

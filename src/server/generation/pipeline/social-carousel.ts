import sharp from "sharp";
import { renderFactLayer, LayoutCapacityError } from "./fact-layer";
import { applyBrandingOverlay } from "./branding-overlay";
import type { FooterStyle } from "./footer-styles";
import { socialFeedMaxHeightPx, SOCIAL_FEED_PRIMARY } from "@/lib/platform-formats";
import type { BrandAsset } from "@/lib/brand-identity";
import type { AdvertisementFacts, VerifiedAgencyProfile } from "./types";
import type { RecruitmentCampaign } from "./content-intelligence";
import type { SlidePlan, SlideKind } from "./social-product-decision";
import { factsForSlide, COVER_HOOK_ROLES } from "./social-product-decision";
import { extendCanvasHeight, fitWithoutCropping } from "./artwork-canvas";

/**
 * SOCIAL CAROUSEL RENDERING (Final Commercial Delivery Directive §3, §7).
 *
 * The decision layer already knows when a requirement needs more than one
 * canvas. This turns that decision into real output — using ONLY the
 * existing engine. There is no second advertisement renderer here: every
 * slide goes through the same `renderFactLayer` and the same
 * `applyBrandingOverlay` a single-image advertisement does, with the same
 * typography roles, the same scrim law, the same protected trust footer
 * and the same Social Feed ceiling. What differs per slide is only WHICH
 * verified facts it carries.
 *
 * Factual integrity across the carousel is structural: slides are built
 * from position INDEXES supplied by the plan, every index appears on
 * exactly one slide, and no slide may invent, merge or restate a count.
 */

export interface CarouselSlideRender {
  index: number;
  kind: SlideKind;
  title: string;
  png: Buffer;
  widthPx: number;
  heightPx: number;
  /** Positions carried by this slide — empty for COVER and TRUST_CTA. */
  positionIndexes: number[];
}

export interface RenderSocialCarouselInput {
  facts: AdvertisementFacts;
  campaign: RecruitmentCampaign;
  slides: SlidePlan[];
  widthPx?: number;
  heightPx?: number;
  agencyProfile: VerifiedAgencyProfile;
  /**
   * Identity slots, not interchangeable buffers: the tenant's primary
   * mark and KAI's verification QR. Role-tagged assets are checked at
   * the slot (see @/lib/brand-identity); a client / hiring-company logo
   * belongs to the artwork, never to either of these.
   */
  agencyLogoPng?: Buffer | BrandAsset | null;
  qrPng?: Buffer | BrandAsset | null;
  headerZoneHasStrongSubject?: boolean;
  /**
   * Gemini artwork for the campaign. Reused across slides so the whole
   * carousel reads as one campaign; each slide composites the fact layer
   * over it exactly as the single-image path does. When absent the fact
   * layer renders on its own (the existing standalone behaviour).
   */
  artworkPng?: Buffer | null;

  /**
   * Trust-footer identity, already resolved by the caller.
   *
   * The single-image path resolves each field from explicit pipeline
   * input first and the verified agency profile second. A slide's
   * footer must be the SAME footer, so the resolved values are passed
   * in rather than re-derived here from the profile alone — two
   * resolutions would eventually disagree, and the footer is the part
   * of the advertisement a candidate is asked to trust. Each field
   * falls back to the agency profile when not supplied.
   */
  footer?: {
    registrationNumber?: string | null;
    officialPhone?: string | null;
    officialEmail?: string | null;
    website?: string | null;
    addressLine?: string | null;
    brandBadges?: string[] | null;
    footerStyle?: FooterStyle | null;
  };
}

/**
 * Renders every planned slide at the canonical Social Feed size, through
 * the existing single-image engine.
 *
 * A slide that cannot fit its own canvas throws the same
 * LayoutCapacityError a single image would — the carousel never silently
 * shrinks type or drops a role to make a slide work. `planCarousel`'s
 * capacity-aware splitting (see social-product-decision.ts) is what keeps
 * that from happening in practice.
 */
export async function renderSocialCarousel(
  input: RenderSocialCarouselInput,
): Promise<CarouselSlideRender[]> {
  const widthPx = input.widthPx ?? SOCIAL_FEED_PRIMARY.widthPx;
  const heightPx = input.heightPx ?? SOCIAL_FEED_PRIMARY.heightPx;
  const ceiling = socialFeedMaxHeightPx("SOCIAL_FEED", widthPx);

  const rendered: CarouselSlideRender[] = [];

  for (const slide of input.slides) {
    // The cover's hook is a SELECTION, not the complete list — every
    // role is carried in full on a family slide — so trimming the hook
    // until the cover fits omits nothing. Benefits, which are verified
    // facts, are never traded away for it.
    let coverHookRoles = COVER_HOOK_ROLES;
    if (slide.kind === "COVER") {
      while (coverHookRoles > 0) {
        const probe = await renderFactLayer({
          facts: factsForSlide(input.facts, slide, coverHookRoles),
          widthPx,
          heightPx,
          measureOnly: true,
        });
        if (ceiling === null || probe.heightPx <= ceiling) break;
        coverHookRoles -= 1;
      }
    }

    const slideFacts = factsForSlide(input.facts, slide, coverHookRoles);

    let layer;
    try {
      layer = await renderFactLayer({
        facts: slideFacts,
        widthPx,
        heightPx,
        socialFeedMaxHeightPx: ceiling,
        headerZoneHasStrongSubject: input.headerZoneHasStrongSubject,
      });
    } catch (e) {
      if (e instanceof LayoutCapacityError) {
        throw new LayoutCapacityError(
          [
            `Carousel slide ${slide.index} ("${slide.title}") does not fit the Social Feed canvas: ` +
              e.unplaced.join("; "),
          ],
          e.reason,
        );
      }
      throw e;
    }

    // Composite over the campaign artwork exactly as the single-image
    // path does, so every slide is the same campaign visually.
    // The SAME canvas treatment the single-image path applies: the
    // artwork is fitted without cropping, then the canvas is EXTENDED
    // downward when the fact layer grew it. A "cover" resize would crop
    // Gemini's frame, which a single image is never allowed to do — a
    // slide is not a licence to do it either.
    const base = input.artworkPng
      ? await (async () => {
          // Fit to the slide's FINAL height, so the base is always
          // exactly the canvas the fact layer solved for — a base left
          // at the requested height would be taller or shorter than the
          // layer composited onto it.
          const fitted = await fitWithoutCropping(input.artworkPng!, widthPx, layer.heightPx);
          return extendCanvasHeight(fitted, widthPx, layer.heightPx);
        })()
      : await sharp({
          create: { width: widthPx, height: layer.heightPx, channels: 3, background: { r: 11, g: 31, b: 51 } },
        })
          .png()
          .toBuffer();

    const withFacts = await sharp(base)
      .composite([{ input: layer.png, left: 0, top: 0 }])
      .png()
      .toBuffer();

    // Every slide carries the protected agency trust footer — a single
    // slide screenshotted on its own is still verifiable (§8).
    const png = await applyBrandingOverlay({
      imagePng: withFacts,
      widthPx,
      heightPx: layer.heightPx,
      agencyName: input.agencyProfile.agencyName,
      registrationNumber:
        input.footer?.registrationNumber ??
        input.agencyProfile.fullRegistrationNumber ??
        input.agencyProfile.rcNumber ??
        null,
      officialPhone: input.footer?.officialPhone ?? input.agencyProfile.officialPhone ?? null,
      officialEmail: input.footer?.officialEmail ?? input.agencyProfile.officialEmail ?? null,
      website: input.footer?.website ?? input.agencyProfile.website ?? null,
      addressLine: input.footer?.addressLine ?? input.agencyProfile.registeredAddress ?? null,
      agencyLogoPng: input.agencyLogoPng ?? null,
      qrPng: input.qrPng ?? null,
      brandBadges: input.footer?.brandBadges ?? input.agencyProfile.approvedBadges ?? null,
      footerStyle: input.footer?.footerStyle ?? null,
    });

    rendered.push({
      index: slide.index,
      kind: slide.kind,
      title: slide.title,
      png,
      widthPx,
      heightPx: layer.heightPx,
      positionIndexes: slide.positionIndexes,
    });
  }

  return rendered;
}

/**
 * Factual-integrity guard for RENDERED output (not just the plan):
 * every position in the campaign is carried by exactly one rendered
 * slide, and the vacancy total across the carousel equals the source
 * total. Throws rather than returning a carousel that lost a role.
 */
export function assertCarouselIntegrity(
  campaign: RecruitmentCampaign,
  rendered: CarouselSlideRender[],
): void {
  const seen = new Map<number, number>();
  for (const slide of rendered) {
    for (const idx of slide.positionIndexes) {
      const prior = seen.get(idx);
      if (prior !== undefined) {
        throw new Error(
          `Rendered carousel duplicates position ${idx} ("${campaign.positions[idx]?.title}") ` +
            `on slides ${prior} and ${slide.index}.`,
        );
      }
      seen.set(idx, slide.index);
    }
  }
  const missing = campaign.positions
    .map((p, i) => (seen.has(i) ? null : `${i} ("${p.title}")`))
    .filter((v): v is string => v !== null);
  if (missing.length > 0) {
    throw new Error(`Rendered carousel drops ${missing.length} position(s): ${missing.join(", ")}.`);
  }

  const carried = [...seen.keys()].reduce((n, i) => n + (campaign.positions[i].count ?? 0), 0);
  if (carried !== campaign.vacancySummary.totalVacancies) {
    throw new Error(
      `Rendered carousel carries ${carried} vacancies but the source states ` +
        `${campaign.vacancySummary.totalVacancies}.`,
    );
  }
}

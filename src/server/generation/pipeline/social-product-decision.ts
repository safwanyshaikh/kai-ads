import { roleTextWidth } from "@/lib/kdl-typography";
import type { AdvertisementFacts } from "./types";
import { renderFactLayer, LayoutCapacityError } from "./fact-layer";
import { socialFeedMaxHeightPx, SOCIAL_FEED_PRIMARY } from "@/lib/platform-formats";
import type { RecruitmentCampaign } from "./content-intelligence";
import { compressedStatementCount } from "./content-intelligence";

/**
 * SOCIAL PRODUCT DECISION (Final Production Lock §10A).
 *
 * KAI must not treat every recruitment requirement as a single-image
 * problem. Before rendering, it measures the actual information mass of
 * the requirement and decides which social PRODUCT the requirement
 * deserves:
 *
 *   SINGLE_IMAGE  the complete requirement fits, readably, inside the
 *                 approved Social Feed canvas.
 *   CAROUSEL      it does not — and the correct commercial response is
 *                 a multi-slide campaign, never unreadable type, never a
 *                 taller-than-legal canvas, never a dropped role.
 *
 * This is a RECOMMENDATION layer, deliberately: the renderer's own
 * LayoutCapacityError remains the authoritative hard gate (exactly the
 * relationship enforceDtpCapacity already has with the fact layer). This
 * module never renders, never drops a fact, and never changes a count —
 * it decides how many canvases the truth needs.
 */

export type SocialProduct = "SINGLE_IMAGE" | "CAROUSEL";

/**
 * The measured signals that drive the decision (§10A "CONTENT MASS
 * SIGNALS"). A crude `roles > 15` threshold is explicitly rejected by
 * the lock: 19 compactly-grouped roles may still fit one image, while 35
 * heavily-qualified roles will not. Mass, not count.
 */
export interface ContentMass {
  roleCount: number;
  familyCount: number;
  /** Rendered lines the role list will occupy, including family headings and common-requirement lines. */
  visibleRoleLines: number;
  sharedRequirementCount: number;
  uniqueRequirementCount: number;
  qualificationMass: number;
  certificationMass: number;
  benefitMass: number;
  interviewMass: number;
  /** Estimated total vertical px the body content needs at the canonical width. */
  totalMeasuredTextHeight: number;
}

export interface SocialProductDecision {
  product: SocialProduct;
  mass: ContentMass;
  /** Body height the content needs vs. the body height the Feed canvas can give it. */
  requiredBodyHeightPx: number;
  availableBodyHeightPx: number;
  /** Human-readable justification — surfaced to the recruiter, per §10A. */
  reason: string;
  /** Present only when product === "CAROUSEL". */
  slides?: SlidePlan[];
}

export type SlideKind = "COVER" | "ROLE_FAMILY" | "TRUST_CTA";

export interface SlidePlan {
  index: number;
  kind: SlideKind;
  title: string;
  /** Families carried by this slide — empty for COVER and TRUST_CTA. */
  familyLabels: string[];
  /** Indexes into campaign.positions. Every position appears on exactly one slide. */
  positionIndexes: number[];
}

/* -------------------------------------------------------------------------- */
/* MEASUREMENT                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Line-height factors mirroring what the fact layer actually draws for
 * each kind of row (title line, detail line, family heading). Kept
 * deliberately conservative — this decides a PRODUCT, so it must not
 * cheerfully promise a single image the renderer then refuses.
 */
const TITLE_LINE_FACTOR = 1.25;
const DETAIL_LINE_FACTOR = 1.3;
const FAMILY_HEADING_FACTOR = 1.9;
const COMMON_LINE_FACTOR = 1.5;

/** KDL type scale fractions of canvas width, matching fact-layer's KDL_TYPE. */
const TITLE_SIZE_FRAC = 0.02;
const DETAIL_SIZE_FRAC = 0.016;

/** Fraction of canvas width the fact layer leaves as horizontal margin (2 x KDL margin). */
const MARGIN_FRAC = 0.065 * 2;
/** The bullet + gap reserved before every role title. */
const BULLET_FRAC = 0.014;

export function measureContentMass(campaign: RecruitmentCampaign, widthPx: number): ContentMass {
  const titleSize = Math.round(TITLE_SIZE_FRAC * widthPx);
  const detailSize = Math.round(DETAIL_SIZE_FRAC * widthPx);
  const contentW = widthPx * (1 - MARGIN_FRAC) - widthPx * BULLET_FRAC;

  const familyLabels = new Set(campaign.roleFamilies.map((f) => f.label));

  let visibleRoleLines = 0;
  let height = 0;

  // Family headings + their shared requirement lines.
  for (const family of campaign.roleFamilies) {
    height += familyHeadingHeight(detailSize);
    visibleRoleLines += 1;
    for (const _shared of family.commonRequirement) {
      void _shared;
      height += Math.round(detailSize * COMMON_LINE_FACTOR);
      visibleRoleLines += 1;
    }
  }

  // Every position: its (wrapped) title line(s) plus any detail line.
  let qualificationMass = 0;
  let certificationMass = 0;
  for (const p of campaign.positions) {
    const label = `${p.title} (${p.count ?? 0} NOS)`;
    const lines = Math.max(1, Math.ceil(roleTextWidth(label, titleSize, "POSITION") / contentW));
    height += Math.round(titleSize * TITLE_LINE_FACTOR * lines);
    visibleRoleLines += lines;

    const detailBits: string[] = [];
    if (p.experience) detailBits.push(p.experience);
    if (p.qualification) {
      detailBits.push(p.qualification);
      qualificationMass += p.qualification.length;
    }
    if (p.certifications?.length) {
      detailBits.push(p.certifications.join(", "));
      certificationMass += p.certifications.join(", ").length;
    }
    if (detailBits.length > 0) {
      const detail = detailBits.join(" · ");
      const dLines = Math.max(1, Math.ceil(roleTextWidth(detail, detailSize, "FINE") / contentW));
      height += Math.round(detailSize * DETAIL_LINE_FACTOR * dLines);
      visibleRoleLines += dLines;
    }
  }

  const shared = campaign.roleFamilies.reduce((n, f) => n + f.commonRequirement.length, 0);

  return {
    roleCount: campaign.positions.length,
    familyCount: familyLabels.size,
    visibleRoleLines,
    sharedRequirementCount: shared,
    uniqueRequirementCount: Math.max(0, compressedStatementCount(campaign) - shared),
    qualificationMass,
    certificationMass,
    // Benefits/interview are campaign-level and not carried on the
    // RecruitmentCampaign model; reported as 0 here so the shape is
    // stable and the caller can see they were not a factor.
    benefitMass: 0,
    interviewMass: 0,
    totalMeasuredTextHeight: height,
  };
}

function familyHeadingHeight(detailSize: number): number {
  return Math.round(detailSize * FAMILY_HEADING_FACTOR);
}

/* -------------------------------------------------------------------------- */
/* DECISION                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Body height a Social Feed canvas can actually give the role list at
 * its absolute ceiling, after the parts of the canvas that are never
 * negotiable: the hero/photo band, the campaign identity block, and the
 * protected agency trust footer.
 */
const HERO_BAND_FRAC = 0.34;
const IDENTITY_BLOCK_FRAC = 0.36;
const FOOTER_FRAC = 0.25;

export function availableBodyHeight(widthPx: number, maxHeightPx: number): number {
  const hero = widthPx * HERO_BAND_FRAC;
  const identity = widthPx * IDENTITY_BLOCK_FRAC;
  const footer = Math.min(300, Math.max(250, widthPx * FOOTER_FRAC));
  return Math.max(0, maxHeightPx - hero - identity - footer);
}

/**
 * The §10A decision, in the lock's own order: try the complete
 * requirement, use family grouping and genuinely-shared requirement
 * consolidation (both already applied by buildRecruitmentCampaign),
 * measure again, and only then — if it still exceeds the approved Feed
 * capacity — recommend a carousel.
 */
export function decideSocialProduct(
  campaign: RecruitmentCampaign,
  widthPx: number = SOCIAL_FEED_PRIMARY.widthPx,
): SocialProductDecision {
  const ceiling = socialFeedMaxHeightPx("SOCIAL_FEED", widthPx) ?? widthPx * 2;
  const mass = measureContentMass(campaign, widthPx);
  const available = Math.round(availableBodyHeight(widthPx, ceiling));
  const required = mass.totalMeasuredTextHeight;

  if (required <= available) {
    return {
      product: "SINGLE_IMAGE",
      mass,
      requiredBodyHeightPx: required,
      availableBodyHeightPx: available,
      reason:
        `Fits one image: ${mass.roleCount} positions across ${mass.familyCount} role ` +
        `${mass.familyCount === 1 ? "family" : "families"} need ~${required}px of body height; ` +
        `the ${widthPx}x${ceiling} Social Feed ceiling allows ~${available}px.`,
    };
  }

  const slides = planCarousel(campaign, widthPx, available);
  return {
    product: "CAROUSEL",
    mass,
    requiredBodyHeightPx: required,
    availableBodyHeightPx: available,
    reason:
      `Single-image capacity exceeded after family grouping: ${mass.familyCount} role ` +
      `${mass.familyCount === 1 ? "family" : "families"} / ${mass.roleCount} positions / ` +
      `${mass.sharedRequirementCount + mass.uniqueRequirementCount} requirement statements ` +
      `need ~${required}px of body height against ~${available}px available at the ` +
      `${widthPx}x${ceiling} ceiling. Recommended: ${slides.length}-slide carousel.`,
    slides,
  };
}

/**
 * Cover -> role-family slides -> trust/CTA (§10A "CAROUSEL
 * ARCHITECTURE"). The cover is deliberately NOT a dump of all roles.
 *
 * Families are packed onto slides greedily in source order, never split
 * across slides unless a single family alone exceeds one slide's budget
 * (in which case it is chunked, still in source order). Every position
 * lands on exactly one slide — asserted by assertSlidePlanIntegrity.
 */
function planCarousel(campaign: RecruitmentCampaign, widthPx: number, available: number): SlidePlan[] {
  const detailSize = Math.round(DETAIL_SIZE_FRAC * widthPx);
  const titleSize = Math.round(TITLE_SIZE_FRAC * widthPx);
  const perPosition = Math.round(titleSize * TITLE_LINE_FACTOR + detailSize * DETAIL_LINE_FACTOR);
  const perHeading = familyHeadingHeight(detailSize);
  const maxPositionsPerSlide = Math.max(1, Math.floor((available - perHeading) / Math.max(1, perPosition)));

  const slides: SlidePlan[] = [];
  slides.push({
    index: 0,
    kind: "COVER",
    title: "Campaign cover",
    familyLabels: [],
    positionIndexes: [],
  });

  let current: { labels: string[]; idx: number[] } = { labels: [], idx: [] };
  const flush = () => {
    if (current.idx.length === 0) return;
    slides.push({
      index: slides.length,
      kind: "ROLE_FAMILY",
      title: current.labels.join(" · "),
      familyLabels: [...current.labels],
      positionIndexes: [...current.idx],
    });
    current = { labels: [], idx: [] };
  };

  for (const family of campaign.roleFamilies) {
    const members = [...family.positionIndexes];
    while (members.length > 0) {
      const room = maxPositionsPerSlide - current.idx.length;
      if (room <= 0) {
        flush();
        continue;
      }
      const take = members.splice(0, room);
      if (!current.labels.includes(family.label)) current.labels.push(family.label);
      current.idx.push(...take);
      if (members.length > 0) flush();
    }
  }
  flush();

  slides.push({
    index: slides.length,
    kind: "TRUST_CTA",
    title: "How to apply & verified agency identity",
    familyLabels: [],
    positionIndexes: [],
  });

  return slides;
}

/**
 * Factual-integrity guard for the slide plan (§10A "CAROUSEL MUST
 * PRESERVE FACTUAL INTEGRITY"): every position maps to exactly one
 * slide — none lost between slides, none duplicated. Throws rather than
 * shipping a carousel that silently drops a role.
 */
export function assertSlidePlanIntegrity(campaign: RecruitmentCampaign, slides: SlidePlan[]): void {
  const seen = new Map<number, number>();
  for (const slide of slides) {
    for (const idx of slide.positionIndexes) {
      const prior = seen.get(idx);
      if (prior !== undefined) {
        throw new Error(
          `Carousel slide plan duplicates position ${idx} ("${campaign.positions[idx]?.title}") ` +
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
    throw new Error(`Carousel slide plan drops ${missing.length} position(s): ${missing.join(", ")}.`);
  }
}


/* -------------------------------------------------------------------------- */
/* AUTHORITATIVE DECISION                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The decision the pipeline actually uses.
 *
 * Unlike `decideSocialProduct` (a fast, deliberately conservative
 * estimate for callers that have only a RecruitmentCampaign), this asks
 * the RENDERER'S OWN canvas-height solve what the requirement really
 * needs — `renderFactLayer({ measureOnly: true })` — and compares that
 * to the Social Feed ceiling. There is therefore no parallel height
 * model to drift out of agreement with the renderer (Final Production
 * Lock §7, §24): if this says a single image fits, the renderer will
 * render it; if it says carousel, the renderer would have refused.
 */
export async function decideSocialProductForFacts(
  facts: AdvertisementFacts,
  campaign: RecruitmentCampaign,
  widthPx: number,
  heightPx: number,
): Promise<SocialProductDecision> {
  const ceiling = socialFeedMaxHeightPx("SOCIAL_FEED", widthPx);
  const mass = measureContentMass(campaign, widthPx);

  // Formats this law does not constrain (Story/Reel, landscape) are
  // never carousel-recommended by it.
  if (ceiling === null) {
    return {
      product: "SINGLE_IMAGE",
      mass,
      requiredBodyHeightPx: 0,
      availableBodyHeightPx: 0,
      reason: "Not a Social Feed format — the Feed height ceiling does not apply.",
    };
  }

  const measured = await renderFactLayer({ facts, widthPx, heightPx, measureOnly: true });
  const required = measured.heightPx;

  if (required <= ceiling) {
    return {
      product: "SINGLE_IMAGE",
      mass,
      requiredBodyHeightPx: required,
      availableBodyHeightPx: ceiling,
      reason:
        `Fits one image: ${mass.roleCount} positions across ${mass.familyCount} role ` +
        `${mass.familyCount === 1 ? "family" : "families"} render at ${required}px, within the ` +
        `${widthPx}x${ceiling} Social Feed ceiling.`,
    };
  }

  // Plan greedily, then verify every role-family slide against the
  // renderer's own solve and split any that would overflow (§18).
  const planned = planCarousel(campaign, widthPx, availableBodyHeight(widthPx, ceiling));
  const slides = await planCarouselWithCapacity(facts, campaign, planned, widthPx, heightPx);
  return {
    product: "CAROUSEL",
    mass,
    requiredBodyHeightPx: required,
    availableBodyHeightPx: ceiling,
    reason:
      `Single-image capacity exceeded after family grouping: ${mass.familyCount} role ` +
      `${mass.familyCount === 1 ? "family" : "families"} / ${mass.roleCount} positions / ` +
      `${mass.sharedRequirementCount + mass.uniqueRequirementCount} requirement statements ` +
      `render at ${required}px against the ${widthPx}x${ceiling} ceiling. ` +
      `Recommended: ${slides.length}-slide carousel.`,
    slides,
  };
}


/**
 * The cover carries the campaign, not the catalogue (§7): destination,
 * employer, industry, total vacancies and the strongest few roles as a
 * hook — never a dump of every position.
 */
export const COVER_HOOK_ROLES = 4;

function coverFacts(facts: AdvertisementFacts, hookRoles = COVER_HOOK_ROLES): AdvertisementFacts {
  const ranked = [...facts.positions]
    .filter((p) => typeof p.count === "number")
    .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
    .slice(0, hookRoles);
  return {
    ...facts,
    // The badge must state the CAMPAIGN's verified totals, not the
    // totals of the hook selection drawn below it — the remaining roles
    // are carried in full on the family slides.
    // A sum is only stated when EVERY role carries a verified count —
    // otherwise a partial total would be presented as a whole, which is
    // a fabricated fact. Omitting it falls back to counting what is drawn.
    campaignTotals: facts.positions.every((p) => typeof p.count === "number")
      ? {
          vacancies: facts.positions.reduce((sum, p) => sum + (p.count ?? 0), 0),
          roles: facts.positions.length,
        }
      : null,
    // Hook roles only. The full list lives on the family slides.
    // Title + count only. The cover exists to stop the scroll; each
    // role's full qualification/experience detail is stated on its own
    // family slide, so nothing is omitted — only placed once, where it
    // belongs.
    positions: (ranked.length > 0 ? ranked : facts.positions.slice(0, hookRoles)).slice(0, hookRoles).map((p) => ({
      title: p.title,
      count: p.count,
    })),
    // The cover is the scroll-stopper: benefits belong here, the dense
    // per-role detail does not.
    interview: [],
  };
}

function familySlideFacts(facts: AdvertisementFacts, slide: SlidePlan): AdvertisementFacts {
  return {
    ...facts,
    positions: slide.positionIndexes.map((i) => facts.positions[i]),
    // A family slide's badge describes the roles it actually lists, in
    // full — it is not a campaign summary, so it never carries totals.
    campaignTotals: null,
    // Slide identity (§8): the country headline keeps the campaign
    // recognisable, and the family label takes the prominent sub-line so
    // a slide screenshotted on its own still says what it is. The
    // employer/industry sub-lines are established on the cover —
    // repeating them here costs ~115px per slide that the role list
    // needs, which §8 explicitly permits reclaiming ("do not repeat ...
    // unnecessarily if it destroys content capacity"). Agency identity
    // and the QR remain on every slide via the trust footer.
    employer: slide.familyLabels.join(" · ") || slide.title || facts.employer,
    industry: "",
    // Benefits and interview are stated once, on the cover and the
    // trust/CTA slide — repeating them on every family slide would spend
    // capacity the role list needs.
    benefits: [],
    interview: [],
  };
}

function trustSlideFacts(facts: AdvertisementFacts): AdvertisementFacts {
  return {
    ...facts,
    // No role list: this slide is how to apply, plus verified identity.
    positions: [],
    // It still states the campaign's verified size — every one of those
    // roles is listed in full on the slides before it, so the total is
    // an accurate statement of what the reader has just scrolled past.
    campaignTotals: facts.positions.every((p) => typeof p.count === "number")
      ? {
          vacancies: facts.positions.reduce((sum, p) => sum + (p.count ?? 0), 0),
          roles: facts.positions.length,
        }
      : null,
  };
}

export function factsForSlide(facts: AdvertisementFacts, slide: SlidePlan, coverHookRoles?: number): AdvertisementFacts {
  switch (slide.kind) {
    case "COVER":
      return coverFacts(facts, coverHookRoles ?? COVER_HOOK_ROLES);
    case "ROLE_FAMILY":
      return familySlideFacts(facts, slide);
    case "TRUST_CTA":
      return trustSlideFacts(facts);
  }
}


/**
 * Capacity-aware slide planning (§18).
 *
 * The greedy plan above sizes slides from an estimate. This re-packs
 * them against the RENDERER'S own solve: positions are added to a slide
 * one at a time while the slide still fits, and consecutive families
 * share a slide whenever they fit together. That produces the MINIMUM
 * number of slides that all genuinely fit — the earlier approach
 * (halve-until-it-fits) both over-split and could still hand back an
 * oversized slide.
 *
 * Packing only ever moves positions between slides, never drops, merges
 * or reorders one, so the plan's integrity guarantee is preserved
 * (re-assert with assertSlidePlanIntegrity).
 */
export async function planCarouselWithCapacity(
  facts: AdvertisementFacts,
  campaign: RecruitmentCampaign,
  slides: SlidePlan[],
  widthPx: number,
  heightPx: number,
): Promise<SlidePlan[]> {
  const ceiling = socialFeedMaxHeightPx("SOCIAL_FEED", widthPx);
  if (ceiling === null) return slides;

  // Family label for a position index, so a re-packed slide can still
  // name the families it carries.
  const labelOf = new Map<number, string>();
  for (const family of campaign.roleFamilies) {
    for (const idx of family.positionIndexes) labelOf.set(idx, family.label);
  }

  /**
   * Measures the EXACT facts the renderer will draw for this slide —
   * via the shared `factsForSlide` — not an approximation of them. When
   * this measured the full campaign identity block while the renderer
   * drew the reduced per-slide one, the packer sized slides for ~115px
   * of chrome that never appears and produced 12 two-role slides where
   * 3 eight-role slides fit.
   */
  const fits = async (positionIndexes: number[]): Promise<boolean> => {
    if (positionIndexes.length === 0) return true;
    const labels = [...new Set(positionIndexes.map((i) => labelOf.get(i)).filter((v): v is string => Boolean(v)))];
    const probe: SlidePlan = {
      index: 0,
      kind: "ROLE_FAMILY",
      title: labels.join(" · "),
      familyLabels: labels,
      positionIndexes,
    };
    const measured = await renderFactLayer({
      facts: factsForSlide(facts, probe),
      widthPx,
      heightPx,
      measureOnly: true,
    });
    return measured.heightPx <= ceiling;
  };

  const roleSlides = slides.filter((s) => s.kind === "ROLE_FAMILY");
  const ordered = roleSlides.flatMap((s) => s.positionIndexes);

  const packed: number[][] = [];
  let current: number[] = [];
  for (const idx of ordered) {
    const candidate = [...current, idx];
    if (current.length > 0 && !(await fits(candidate))) {
      packed.push(current);
      current = [idx];
      // A single position that cannot fit its own slide is a genuine
      // capacity failure, not something to paper over by splitting
      // further — surface it rather than emitting an oversized slide.
      if (!(await fits(current))) {
        throw new LayoutCapacityError(
          [
            `Position "${facts.positions[idx]?.title}" alone exceeds the ${widthPx}x${ceiling} ` +
              `Social Feed slide canvas at minimum readability.`,
          ],
          "social-feed-exceeds-max-height",
        );
      }
      continue;
    }
    current = candidate;
  }
  if (current.length > 0) packed.push(current);

  const cover = slides.find((s) => s.kind === "COVER");
  const trust = slides.find((s) => s.kind === "TRUST_CTA");
  const out: SlidePlan[] = [];
  if (cover) out.push(cover);
  for (const chunk of packed) {
    const labels = [...new Set(chunk.map((i) => labelOf.get(i)).filter((v): v is string => Boolean(v)))];
    out.push({
      index: 0,
      kind: "ROLE_FAMILY",
      title: labels.join(" · "),
      familyLabels: labels,
      positionIndexes: chunk,
    });
  }
  if (trust) out.push(trust);

  const numbered = await numberSplitFamilies(out, facts, widthPx, heightPx, ceiling);
  return numbered.map((s, i) => ({ ...s, index: i }));
}

/**
 * Slide identity (§8): a slide screenshotted on its own must say what it
 * is. When one role family is too large for a single canvas the packer
 * splits it, and the resulting slides would otherwise carry the SAME
 * heading — two "HVAC & Mechanical" slides a reader cannot tell apart or
 * order. Those get "(1 of 2)", "(2 of 2)".
 *
 * The suffix lengthens the heading, so the numbered plan is re-measured
 * against the ceiling. If any slide no longer fits, numbering is dropped
 * for ALL of them rather than numbering some and not others — capacity
 * outranks the labelling nicety, and a half-numbered set is worse than
 * none.
 */
async function numberSplitFamilies(
  slides: SlidePlan[],
  facts: AdvertisementFacts,
  widthPx: number,
  heightPx: number,
  ceiling: number,
): Promise<SlidePlan[]> {
  const occurrences = new Map<string, number>();
  for (const s of slides) {
    if (s.kind !== "ROLE_FAMILY") continue;
    for (const label of s.familyLabels) {
      occurrences.set(label, (occurrences.get(label) ?? 0) + 1);
    }
  }
  const split = [...occurrences.entries()].filter(([, n]) => n > 1);
  if (split.length === 0) return slides;

  const seen = new Map<string, number>();
  const numbered = slides.map((s) => {
    if (s.kind !== "ROLE_FAMILY") return s;
    const labels = s.familyLabels.map((label) => {
      const total = occurrences.get(label) ?? 1;
      if (total < 2) return label;
      const n = (seen.get(label) ?? 0) + 1;
      seen.set(label, n);
      return `${label} (${n} of ${total})`;
    });
    return { ...s, familyLabels: labels, title: labels.join(" · ") };
  });

  for (const s of numbered) {
    if (s.kind !== "ROLE_FAMILY") continue;
    const measured = await renderFactLayer({
      facts: factsForSlide(facts, s),
      widthPx,
      heightPx,
      measureOnly: true,
    });
    if (measured.heightPx > ceiling) return slides;
  }
  return numbered;
}

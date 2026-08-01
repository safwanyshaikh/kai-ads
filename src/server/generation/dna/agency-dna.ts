import { deriveCompactRegistrationNumber } from "@/lib/registration-number";
import { normaliseBadges, type FooterStyle } from "../pipeline/footer-styles";
import { contrastRatio, DISPLAY_CONTRAST_MIN, FACT_CONTRAST_MIN, parseHex, toHex } from "./contrast";
import type { DesignDNA, DnaPalette } from "./design-dna";

/**
 * Agency DNA — CONFIGURATION DATA, NOT A TEMPLATE ENGINE.
 *
 * The agency's permanent identity, resolved once from the verified Agency
 * profile and carried on the Advertisement JSON. It is brand furniture in
 * the same sense the Footer Library already is: it re-dresses marks the
 * one Rendering Engine already paints, and introduces no mark of its own.
 *
 * Two laws constrain it, and they are the reason this is a resolver rather
 * than a free-form style bag:
 *
 *  1. Nothing here is ever invented. Every field traces to the Agency
 *     record. An agency that has not filled in its profile gets fewer
 *     printed lines, never a plausible-looking substitute.
 *
 *  2. Agency branding may never cost legibility. A brand colour is
 *     accepted only where it still satisfies the Contrast Law against the
 *     roles the engine actually paints it on; otherwise the Design DNA's
 *     own value stands and the substitution is recorded, so an agency can
 *     be told why their orange did not appear rather than silently
 *     wondering.
 */

export interface AgencyProfileRecord {
  id: string;
  name: string;
  registrationNumber: string;
  logoUrl?: string | null;
  secondaryLogoUrl?: string | null;
  officialEmail?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  website?: string | null;
  officeAddress?: string | null;
  brandColours?: unknown;
  brandBadges?: unknown;
  footerStyle?: FooterStyle | null;
}

export interface AgencyDNA {
  agencyId: string;
  /** Legal name, printed verbatim. */
  name: string;
  /** Full official registration string, printed verbatim in small print. */
  registrationNumber: string;
  /** Compact core RC number for constrained areas (the trust badge). */
  compactRegistrationId: string | null;
  logoUrl: string | null;
  secondaryLogoUrl: string | null;
  /** Up to three permanent claims, e.g. "Since 1984". Never ad content. */
  badges: string[];
  /** Null means KAI picks the footer that suits each advertisement. */
  footerStyle: FooterStyle | null;
  contact: {
    phone: string | null;
    whatsapp: string | null;
    email: string | null;
    website: string | null;
    officeAddress: string | null;
  };
  /** Optional brand accents. Applied only where the Contrast Law allows. */
  brand: {
    primary: string | null;
    secondary: string | null;
  };
}

/** Resolves the verified Agency record into Agency DNA. Invents nothing. */
export function buildAgencyDna(agency: AgencyProfileRecord): AgencyDNA {
  const colours = readBrandColours(agency.brandColours);

  return {
    agencyId: agency.id,
    name: agency.name,
    registrationNumber: agency.registrationNumber,
    compactRegistrationId: deriveCompactRegistrationNumber(agency.registrationNumber),
    logoUrl: agency.logoUrl ?? null,
    secondaryLogoUrl: agency.secondaryLogoUrl ?? null,
    badges: normaliseBadges(agency.brandBadges),
    footerStyle: agency.footerStyle ?? null,
    contact: {
      phone: agency.phone ?? null,
      whatsapp: agency.whatsapp ?? null,
      email: agency.officialEmail ?? null,
      website: agency.website ?? null,
      officeAddress: agency.officeAddress ?? null,
    },
    brand: {
      primary: colours.primary,
      secondary: colours.secondary,
    },
  };
}

function readBrandColours(value: unknown): { primary: string | null; secondary: string | null } {
  if (!value || typeof value !== "object") return { primary: null, secondary: null };
  const record = value as Record<string, unknown>;
  const read = (key: string): string | null => {
    const raw = record[key];
    if (typeof raw !== "string") return null;
    const trimmed = raw.trim();
    try {
      parseHex(trimmed);
      return trimmed.toUpperCase();
    } catch {
      // A malformed brand colour is dropped, not guessed at. The agency
      // sees KAI's own palette rather than an approximation of theirs.
      return null;
    }
  };
  return { primary: read("primary"), secondary: read("secondary") };
}

export interface BrandApplication {
  /** The Design DNA palette with any admissible agency colours applied. */
  palette: DnaPalette;
  /** Human-readable notes on what was applied and what was declined. */
  notes: string[];
}

/**
 * Applies agency brand colours over a Design DNA palette.
 *
 * `primary` is offered to the `ink` role (bars, headings, rules) and
 * `secondary` to the `accent` role (straps, the hero numeral). Each is
 * accepted only if EVERY pair the engine paints with that role still meets
 * the Contrast Law — including the paired text roles, which are recomputed
 * against the candidate colour rather than assumed.
 */
export function applyAgencyBrand(dna: DesignDNA, agency: AgencyDNA): BrandApplication {
  const palette: DnaPalette = { ...dna.palette };
  const notes: string[] = [];

  if (agency.brand.primary) {
    const candidate = agency.brand.primary;
    const reversed = bestTextOn(candidate, [palette.reversed, "#FFFFFF", "#000000"]);
    const ok =
      reversed !== null &&
      contrastRatio(candidate, palette.surface) >= FACT_CONTRAST_MIN &&
      contrastRatio(candidate, palette.paper) >= FACT_CONTRAST_MIN &&
      contrastRatio(candidate, palette.tint) >= FACT_CONTRAST_MIN &&
      contrastRatio(palette.accent, candidate) >= DISPLAY_CONTRAST_MIN;
    if (ok) {
      palette.ink = candidate;
      palette.reversed = reversed;
      notes.push(`Agency primary ${candidate} applied to headings, bars and rules.`);
    } else {
      notes.push(
        `Agency primary ${candidate} was not applied: it cannot carry factual text at ` +
          `${FACT_CONTRAST_MIN}:1 against this design's surfaces. ${dna.label}'s own ink is used instead.`,
      );
    }
  }

  if (agency.brand.secondary) {
    const candidate = agency.brand.secondary;
    const accentText = bestTextOn(candidate, [palette.accentText, "#0B1F33", "#FFFFFF", "#000000"]);
    const ok = accentText !== null && contrastRatio(candidate, palette.ink) >= DISPLAY_CONTRAST_MIN;
    if (ok) {
      palette.accent = candidate;
      palette.accentText = accentText;
      notes.push(`Agency secondary ${candidate} applied to straps and the vacancy numeral.`);
    } else {
      notes.push(
        `Agency secondary ${candidate} was not applied: it does not separate from this design's ink at ` +
          `${DISPLAY_CONTRAST_MIN}:1. ${dna.label}'s own accent is used instead.`,
      );
    }
  }

  return { palette, notes };
}

/** The first candidate text colour that clears the fact threshold on `background`. */
function bestTextOn(background: string, candidates: string[]): string | null {
  let best: { colour: string; ratio: number } | null = null;
  for (const c of candidates) {
    const ratio = contrastRatio(c, background);
    if (!best || ratio > best.ratio) best = { colour: c, ratio };
  }
  return best && best.ratio >= FACT_CONTRAST_MIN ? best.colour : null;
}

/** A single "email | phone" line for the trust strip. Omits what is absent. */
export function agencyContactLine(
  agency: AgencyDNA,
  advertisementContact?: { phone?: string; email?: string; whatsapp?: string } | null,
): string | null {
  // An advertisement-level value wins when present: that is a deliberate
  // per-campaign override (a dedicated hotline for one drive), not the
  // default path.
  const phone = advertisementContact?.phone ?? agency.contact.phone ?? agency.contact.whatsapp ?? null;
  const email = advertisementContact?.email ?? agency.contact.email ?? null;
  const parts = [email, phone].filter((v): v is string => Boolean(v));
  return parts.length > 0 ? parts.join(" | ") : null;
}

/** Office address and website for the trust strip, from the profile. */
export function agencyAddressLine(agency: AgencyDNA): string | null {
  const parts = [agency.contact.officeAddress, agency.contact.website].filter((v): v is string => Boolean(v));
  return parts.length > 0 ? parts.join("  ·  ") : null;
}

/**
 * A deterministic darkened/lightened step of a colour, used where a DNA
 * needs a related tone (a rule under a branded bar) rather than a second
 * brand colour the agency never supplied.
 */
export function shade(hex: string, amount: number): string {
  const { r, g, b } = parseHex(hex);
  const k = Math.max(-1, Math.min(1, amount));
  const mix = (v: number) => (k >= 0 ? v + (255 - v) * k : v * (1 + k));
  return toHex(mix(r), mix(g), mix(b));
}

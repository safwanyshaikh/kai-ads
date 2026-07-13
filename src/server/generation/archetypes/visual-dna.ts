import sharp from "sharp";

/**
 * Agency Visual DNA — controlled tenant-level visual continuity.
 *
 * Purpose: ~5-15% recognizable continuity across an agency's
 * advertisements (their colors on the banner/CTA/verification panel,
 * their logo placement) while every archetype keeps its own genuinely
 * distinct composition. DNA influences color and identity treatment
 * ONLY — never layout structure — so it cannot collapse the four
 * archetypes into one template.
 *
 * Derivation: from verified tenant assets only. The Agency table today
 * carries logoUrl/secondaryLogoUrl and no brand-color columns, so the
 * palette is extracted deterministically from the agency's own logo
 * (no schema migration needed). `overrides` exists so a future brand
 * settings column can take precedence without touching this module's
 * callers.
 */
export interface AgencyVisualDna {
  /** Dominant brand color — identity banners, strips, CTA bars. */
  primaryColor: string;
  /** Second brand color — checkmarks, chips, secondary accents. */
  secondaryColor: string;
  /** High-emphasis accent — eyebrow lines, selling-point highlights. */
  accentColor: string;
  /** Whether a logo asset exists (drives logo-slot rendering in engines). */
  hasLogo: boolean;
}

export interface VisualDnaOverrides {
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
}

const HEX = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;

/** Perceived darkness guard — banner/CTA colors must hold white text. */
function darkenForContrast(r: number, g: number, b: number): [number, number, number] {
  const luma = 0.299 * r + 0.587 * g + 0.114 * b;
  if (luma <= 140) return [r, g, b];
  const f = 140 / luma;
  return [r * f, g * f, b * f];
}

/**
 * Extracts the two most-present saturated hues from the logo. Pixels
 * that are near-white, near-black, or desaturated are ignored (they're
 * background/outline, not brand). Deterministic: same logo, same DNA.
 */
export async function resolveAgencyVisualDna(params: {
  logo?: Buffer | null;
  overrides?: VisualDnaOverrides | null;
}): Promise<AgencyVisualDna> {
  const fallback: AgencyVisualDna = {
    primaryColor: "#0d4f8b",
    secondaryColor: "#1f6f4a",
    accentColor: "#c0392b",
    hasLogo: Boolean(params.logo),
  };

  let derived = fallback;
  if (params.logo) {
    try {
      const { data, info } = await sharp(params.logo)
        .resize(64, 64, { fit: "inside" })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      // Bucket saturated pixels by coarse hue; accumulate average RGB per bucket.
      const buckets = new Map<number, { r: number; g: number; b: number; n: number }>();
      for (let i = 0; i < data.length; i += info.channels) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];
        if (a < 200) continue;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        if (max > 235 && min > 210) continue; // near-white
        if (max < 40) continue; // near-black
        if (max - min < 30) continue; // desaturated
        const hue = rgbToHueBucket(r, g, b);
        const bucket = buckets.get(hue) ?? { r: 0, g: 0, b: 0, n: 0 };
        bucket.r += r;
        bucket.g += g;
        bucket.b += b;
        bucket.n += 1;
        buckets.set(hue, bucket);
      }

      const ranked = [...buckets.values()].sort((a, b) => b.n - a.n);
      if (ranked.length > 0) {
        const primary = darkenForContrast(ranked[0].r / ranked[0].n, ranked[0].g / ranked[0].n, ranked[0].b / ranked[0].n);
        const second = ranked[1] ?? ranked[0];
        const secondary = darkenForContrast(second.r / second.n, second.g / second.n, second.b / second.n);
        derived = {
          primaryColor: HEX(...primary),
          secondaryColor: HEX(...secondary),
          // Accent stays a high-emphasis warm tone unless overridden —
          // extracted brand colors are often cool and read poorly as urgency.
          accentColor: fallback.accentColor,
          hasLogo: true,
        };
      }
    } catch {
      // Unreadable logo → deterministic fallback palette; never fails generation.
    }
  }

  return {
    primaryColor: params.overrides?.primaryColor ?? derived.primaryColor,
    secondaryColor: params.overrides?.secondaryColor ?? derived.secondaryColor,
    accentColor: params.overrides?.accentColor ?? derived.accentColor,
    hasLogo: derived.hasLogo,
  };
}

/** 12-bucket coarse hue for clustering. */
function rgbToHueBucket(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return Math.floor(h / 30);
}

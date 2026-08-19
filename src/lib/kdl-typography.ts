/**
 * KDL TYPOGRAPHY — the single source of truth for the locked five-role
 * type system (docs/012 / the AAT DTP framework).
 *
 * This lives in src/lib rather than inside a renderer because BOTH
 * renderers consume it — the fact layer and the trust footer — and
 * `fact-layer.ts` already imports from `branding-overlay.ts`, so the
 * registry cannot live in either without creating a cycle or a second
 * copy of the constants (Final Production Lock §24: one source for
 * every canonical geometry constant, no duplicate constants across
 * renderers).
 *
 * The engine never names a typeface. It asks for the semantic ROLE it
 * needs, exactly the way it already asks the palette for a colour role;
 * that indirection is what lets one drawing pass carry a real hierarchy
 * instead of one face at seven sizes.
 *
 *   DISPLAY  Anton            agency/employer identity, big callouts
 *   SECTION  Oswald           country, section bars, family headings, labels
 *   POSITION Barlow Condensed job titles, dense role lists
 *   NUMERIC  Archivo Black    vacancy counts, key numerals
 *   FINE     Roboto Condensed address, registration, trust/legal fine print
 *   BASE     Liberation Sans  the pre-existing single face; the fallback
 *                             inside every stack, so a missing role face
 *                             degrades to a real glyph, never tofu.
 *
 * Families resolve through fontconfig — see
 * src/server/generation/fonts/fonts.conf, which aliases each Kai* name
 * to the bundled OFL face.
 */
export type TypeRole = "DISPLAY" | "SECTION" | "POSITION" | "NUMERIC" | "FINE" | "BASE";

/**
 * `upper`/`mixed` are MEASURED advance-width factors — produced by
 * scripts/measure-font-metrics.ts, which rasterizes each bundled face
 * through the same librsvg the renderers draw with and divides real ink
 * width by (characters x fontSize). They are rounded UP from the
 * measurement: over-reserving costs a little space, under-reserving is
 * what lets a wrapped line escape the row a planner reserved for it.
 */
export interface TypeRoleSpec {
  family: string;
  upper: number;
  mixed: number;
}

export const TYPE_ROLE: Record<TypeRole, TypeRoleSpec> = {
  // Anton — measured upper 0.421 / mixed 0.449.
  DISPLAY: { family: "KaiDisplay, KaiSans, sans-serif", upper: 0.44, mixed: 0.47 },
  // Oswald — measured upper 0.468-0.490 / mixed 0.425-0.451 across w500-700.
  SECTION: { family: "KaiHeader, KaiSans, sans-serif", upper: 0.5, mixed: 0.46 },
  // Barlow Condensed — measured upper 0.416 / mixed 0.397 (w600 and w700 alike).
  POSITION: { family: "KaiPosition, KaiSans, sans-serif", upper: 0.43, mixed: 0.41 },
  // Archivo Black — measured upper 0.691 / mixed 0.610. Heavy and wide by design.
  NUMERIC: { family: "KaiNumeric, KaiSans, sans-serif", upper: 0.7, mixed: 0.62 },
  // Roboto Condensed — measured upper 0.494-0.503 / mixed 0.438-0.447.
  FINE: { family: "KaiFine, KaiSans, sans-serif", upper: 0.51, mixed: 0.46 },
  // Liberation Sans — measured upper 0.606-0.613 / mixed 0.497-0.533.
  BASE: { family: "KaiSans, sans-serif", upper: 0.62, mixed: 0.56 },
};

/** The font-family attribute value for a role — the ONE place a family string is produced. */
export function roleFamily(role: TypeRole = "BASE"): string {
  return TYPE_ROLE[role].family;
}

/**
 * Advance-width factor for a role. Uppercase runs wider than mixed case
 * in every one of these faces, so the case of the actual string still
 * selects the factor — but the factor itself now comes from the face
 * that will really draw it.
 */
export function roleWidthFactor(text: string, role: TypeRole = "BASE"): number {
  const spec = TYPE_ROLE[role];
  const upper = text === text.toUpperCase() && /[A-Z]/.test(text);
  return upper ? spec.upper : spec.mixed;
}

/** Estimated advance width of `text` at `size`, in the given role's real face. */
export function roleTextWidth(text: string, size: number, role: TypeRole = "BASE"): number {
  return text.length * size * roleWidthFactor(text, role);
}

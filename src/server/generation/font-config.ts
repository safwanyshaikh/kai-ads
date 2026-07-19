import path from "node:path";

/**
 * Sprint 006 Bug 005 — points fontconfig at the fonts bundled in this
 * repository BEFORE the first sharp/librsvg text rasterization in the
 * process (fontconfig reads FONTCONFIG_FILE once, at its first init).
 *
 * Why this exists: librsvg ignores the @font-face data embedded in our
 * SVGs (FIX-010) — it resolves font families exclusively through
 * fontconfig. On hosts with no installed fonts (Vercel serverless),
 * every glyph rendered as a hollow "tofu" box. With this file's env
 * assignment, the bundled Liberation faces in
 * src/server/generation/fonts/ become the font database everywhere,
 * identically, regardless of what the host has installed.
 *
 * Imported for its side effect by embedded-fonts.ts (every archetype)
 * and image-export.service.ts (every rasterize/export path), so no
 * text can be rasterized before this runs. An operator-provided
 * FONTCONFIG_FILE is respected and never overridden.
 */
process.env.FONTCONFIG_FILE ??= path.join(
  process.cwd(),
  "src/server/generation/fonts/fonts.conf",
);

export const FONTCONFIG_CONFIGURED = true;

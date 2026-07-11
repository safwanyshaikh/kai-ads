/**
 * Visual style must always produce a real, finished advertisement — "No
 * type may remain architecture-only. No type may return 'not
 * implemented.'" When the KAI Creative Engine isn't configured
 * (OPENAI_API_KEY unset), this supplies a deterministic, industry-themed
 * gradient instead of an AI photo. It is never presented as an AI-
 * generated photo — it's a plain, honest fallback so Visual still
 * completes rather than blocking the recruiter.
 */

const INDUSTRY_PALETTES: Record<string, [string, string]> = {
  "oil & gas": ["#0b3d2e", "#1f6f4a"],
  petrochemical: ["#1a3c34", "#2f6b5e"],
  construction: ["#7a4a1f", "#c98a3a"],
  marine: ["#0a2f4f", "#1c5f8a"],
  shipyard: ["#0a2f4f", "#2c5f7a"],
  offshore: ["#08283f", "#1a5276"],
  "power & energy": ["#3d2b0b", "#a86f1f"],
  manufacturing: ["#2b2b2b", "#5a5a5a"],
  automotive: ["#1c1c1c", "#3a3a3a"],
  healthcare: ["#0d3b3b", "#1f7a6e"],
  hospitality: ["#4a2b0f", "#a8712f"],
  retail: ["#3b1d3b", "#7a3f7a"],
  fmcg: ["#1d3b1d", "#3f7a3f"],
  logistics: ["#1d2b3b", "#3f5a7a"],
  infrastructure: ["#2b2b1d", "#5a5a3f"],
  water: ["#0a3f4f", "#1c7a8a"],
  mining: ["#2b1d0f", "#5a3f1f"],
  aviation: ["#0a1f3f", "#1c3a7a"],
};

const DEFAULT_PALETTE: [string, string] = ["#1a1a2e", "#3a3a5e"];

function paletteFor(industry: string): [string, string] {
  return INDUSTRY_PALETTES[industry.trim().toLowerCase()] ?? DEFAULT_PALETTE;
}

export function buildFallbackBackgroundSvgFragment(params: {
  widthPx: number;
  heightPx: number;
  industry: string;
}): string {
  const [from, to] = paletteFor(params.industry);
  const gradientId = "kaiFallbackBg";
  return `<defs>
    <linearGradient id="${gradientId}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${from}" />
      <stop offset="100%" stop-color="${to}" />
    </linearGradient>
  </defs>
  <rect width="${params.widthPx}" height="${params.heightPx}" fill="url(#${gradientId})" />`;
}

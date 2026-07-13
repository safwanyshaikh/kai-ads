import { PNG } from "pngjs";
import jsQR from "jsqr";
import type { AdvertisementFacts } from "../archetypes";

/**
 * Deterministic acceptance gates (Task: "do not let AI visual QA become
 * fake precision"). These run BEFORE the Visual QA Brain on every
 * iteration; an AI score can never override a failure here, because the
 * loop returns/blocks without ever calling the vision model when a
 * deterministic gate fails.
 */

export interface GateResult {
  passed: boolean;
  failures: string[];
}

function stripNonContent(svg: string): string {
  // Embedded-font base64 can coincidentally contain any substring —
  // gates are about recruiter-facing content.
  return svg.replace(/<style>[\s\S]*?<\/style>/g, "");
}

function escapeForSvgMatch(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * GATE A — Source Fidelity: every grounded fact must appear verbatim in
 * the composed SVG, and no placeholder text may appear. This is the
 * Truth Brain's deterministic backstop at the composition layer.
 */
export function runSourceFidelityGate(facts: AdvertisementFacts, svg: string): GateResult {
  const content = stripNonContent(svg);
  const failures: string[] = [];

  const mustContain: { label: string; value: string }[] = [
    { label: "header", value: facts.header },
    ...facts.positions.map((p, i) => ({ label: `position[${i}]`, value: p.title })),
    ...facts.benefits.map((b, i) => ({ label: `benefit[${i}]`, value: b.label })),
    ...facts.interview.flatMap((e, i) =>
      [e.location, e.date].filter((v): v is string => Boolean(v)).map((v) => ({ label: `interview[${i}]`, value: v })),
    ),
    ...[facts.contact.phone, facts.contact.email, facts.contact.whatsapp]
      .filter((v): v is string => Boolean(v))
      .map((v) => ({ label: "contact", value: v })),
    { label: "agencyName", value: facts.agencyName },
  ];

  const contentLower = content.toLowerCase();
  for (const { label, value } of mustContain) {
    const escaped = escapeForSvgMatch(value).toLowerCase();
    if (contentLower.includes(escaped)) continue;
    // Engines legitimately word-wrap long strings (headlines, notes)
    // across separate <text> lines and may change case for display
    // (mastheads, pills) — so fall back to requiring every word of the
    // value to be present. Facts still cannot go missing: a dropped or
    // altered word fails.
    const words = escaped.split(/\s+/).filter(Boolean);
    const allWordsPresent = words.length > 1 && words.every((w) => contentLower.includes(w));
    if (!allWordsPresent) {
      failures.push(`Missing grounded ${label}: "${value}"`);
    }
  }

  for (const placeholder of ["N/A", "Not Available", "Lorem ipsum", "undefined", "[object Object]"]) {
    if (content.includes(placeholder)) {
      failures.push(`Placeholder text leaked into the composition: "${placeholder}"`);
    }
  }

  return { passed: failures.length === 0, failures };
}

/**
 * GATE B — Technical Render: the raster must be a real PNG at exactly
 * the platform format's dimensions.
 */
export function runTechnicalRenderGate(
  pngBuffer: Buffer,
  expected: { widthPx: number; heightPx: number },
): GateResult {
  const failures: string[] = [];
  try {
    const decoded = PNG.sync.read(pngBuffer);
    if (decoded.width !== expected.widthPx || decoded.height !== expected.heightPx) {
      failures.push(
        `Raster is ${decoded.width}x${decoded.height}, expected ${expected.widthPx}x${expected.heightPx}`,
      );
    }
  } catch {
    failures.push("Raster is not a decodable PNG");
  }
  return { passed: failures.length === 0, failures };
}

/**
 * GATE C — QR Verification: the KAI QR must decode back to the exact
 * KAI-controlled verification URL from the FINAL raster (full-canvas
 * scan with a panel-region fallback, mirroring how a phone camera
 * localizes on the code).
 */
export async function runQrGate(
  pngBuffer: Buffer,
  expectedUrl: string,
  cropToPanelRegion?: (png: Buffer) => Promise<Buffer>,
): Promise<GateResult> {
  const decodeFrom = (buffer: Buffer): string | null => {
    try {
      const decoded = PNG.sync.read(buffer);
      return jsQR(new Uint8ClampedArray(decoded.data), decoded.width, decoded.height)?.data ?? null;
    } catch {
      return null;
    }
  };

  let value = decodeFrom(pngBuffer);
  if (value !== expectedUrl && cropToPanelRegion) {
    value = decodeFrom(await cropToPanelRegion(pngBuffer));
  }
  return value === expectedUrl
    ? { passed: true, failures: [] }
    : { passed: false, failures: [`QR did not decode to the KAI verification URL (got ${value ?? "nothing"})`] };
}

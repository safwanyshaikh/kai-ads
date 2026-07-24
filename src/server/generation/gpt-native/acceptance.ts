/**
 * GPT-Native Acceptance (Sprint 008 Workstream E).
 *
 * The GPT-native pipeline lets GPT render ALL typography — which makes
 * output verification constitutional law, not a nicety (Supreme
 * Principles 6/7/8 and the Success Criteria: immediately publishable,
 * zero spelling correction). This module is the verification instrument:
 *
 *   1. QR gate (deterministic, HARD): the composited trust-zone QR must
 *      decode back to the exact tracking URL — same law as the legacy
 *      pipeline's deterministic gate.
 *   2. Rendered-fact verification (vision): the model reads the FINAL
 *      image and reports any grounded fact (position titles, phone,
 *      email, salary, dates, agency name) that is misspelled, altered,
 *      or illegible. Presentation-only: it never judges whether facts
 *      are true — only whether the image says what the facts say.
 *   3. Commercial Visual QA (vision): reuses the existing Brain-D
 *      provider verbatim, under a GPT_NATIVE_FULL archetype label so its
 *      legacy VISUAL_HERO anti-text rule (correct for the legacy hybrid
 *      canvas, wrong for GPT-owned typography) does not apply.
 *
 * Vision checks degrade honestly: with no OPENAI_API_KEY they are
 * SKIPPED and reported as skipped — never faked, never blocking.
 * Nothing here ever redraws the artwork (Supreme Principle 2) — the only
 * remedies are regenerate or flag for review.
 */

import { z } from "zod";
import sharp from "sharp";
import { PNG } from "pngjs";
import jsQR from "jsqr";
import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAiClient, getKaiVisionModel } from "@/server/ai/openai/openai-client";
import { getIntegrationStatus } from "@/lib/env";
import { getVisualQaProvider, type VisualQaResult } from "@/server/ai/visual-qa";
import { createLogger } from "@/lib/logger";
import type { AdvertisementFacts } from "../archetypes/types";
import { TRUST_ZONE } from "./master-prompt-builder";

const log = createLogger("gpt-native-acceptance");

/** Structured verdict for the rendered-fact verification pass. */
export const renderedFactCheckSchema = z.object({
  /** Facts visibly misspelled or altered vs. the provided list, quoted as seen on the image. */
  misspelledOrAlteredFacts: z.array(z.string()),
  /** Provided facts that are entirely absent from the image. */
  missingCriticalFacts: z.array(z.string()),
  /** Text present but too small/low-contrast/garbled to read reliably. */
  legibilityIssues: z.array(z.string()),
});
export type RenderedFactCheck = z.infer<typeof renderedFactCheckSchema>;

export interface GptNativeAcceptanceInput {
  finalPng: Buffer;
  facts: AdvertisementFacts;
  expectedQrUrl: string;
  widthPx: number;
  heightPx: number;
  platformFormatKey: string;
}

export interface GptNativeAcceptanceOutcome {
  /** Hard gate — false means the advertisement must not be accepted at all. */
  qrDecodable: boolean;
  /** True when the vision checks actually ran (OPENAI_API_KEY configured). */
  visionChecksRan: boolean;
  /** 0-100 from the commercial Visual QA brain; null when skipped/failed. */
  visualQaScore: number | null;
  /** The full per-dimension Visual QA verdict (certification/benchmark evidence); null when skipped. */
  visualQa: VisualQaResult | null;
  /** The full rendered-fact proofread verdict; null when skipped. */
  factCheck: RenderedFactCheck | null;
  /** Human-readable defect strings across all checks (empty = clean). */
  defects: string[];
  /** True when defects warrant one bounded regeneration attempt. */
  shouldRegenerate: boolean;
}

/** Crops the reserved trust zone and decodes the QR out of the FINAL image — proof, not assumption. */
export async function verifyTrustZoneQr(
  finalPng: Buffer,
  expectedUrl: string,
  widthPx: number,
  heightPx: number,
): Promise<boolean> {
  try {
    const zoneW = Math.round(widthPx * (TRUST_ZONE.widthPct / 100));
    const zoneH = Math.round(heightPx * (TRUST_ZONE.heightPct / 100));
    const cropped = await sharp(finalPng)
      .extract({ left: widthPx - zoneW, top: heightPx - zoneH, width: zoneW, height: zoneH })
      .png()
      .toBuffer();
    const decoded = PNG.sync.read(cropped);
    const result = jsQR(new Uint8ClampedArray(decoded.data), decoded.width, decoded.height);
    return result !== null && result.data === expectedUrl;
  } catch (error) {
    log.warn({ err: error }, "Trust-zone QR verification failed to run");
    return false;
  }
}

/** Lists every grounded text fact the image is expected to carry, for the vision checker. */
function expectedFactLines(facts: AdvertisementFacts): string[] {
  return [
    `Header: ${facts.header}`,
    ...(facts.employer ? [`Employer: ${facts.employer}`] : []),
    `Country: ${facts.country}`,
    ...facts.positions.map(
      (p) => `Position: ${p.title}${p.count ? ` (${p.count})` : ""}${p.salary ? ` — ${p.salary}` : ""}`,
    ),
    ...facts.benefits.map((b) => `Benefit: ${b.label}${b.detail ? ` (${b.detail})` : ""}`),
    ...facts.interview.map((i) => `Interview: ${[i.date, i.location].filter(Boolean).join(" at ")}`),
    ...(facts.contact.phone ? [`Phone: ${facts.contact.phone}`] : []),
    ...(facts.contact.email ? [`Email: ${facts.contact.email}`] : []),
    ...(facts.contact.whatsapp ? [`WhatsApp: ${facts.contact.whatsapp}`] : []),
    `Agency: ${facts.agencyName}`,
  ];
}

/** Vision pass: does the FINAL image spell every grounded fact exactly? Null when unconfigured. */
export async function verifyRenderedFacts(
  finalPng: Buffer,
  facts: AdvertisementFacts,
): Promise<RenderedFactCheck | null> {
  if (!getIntegrationStatus().openai) return null;

  const client = getOpenAiClient();
  const response = await client.responses.parse({
    model: getKaiVisionModel(),
    instructions: [
      "You are a print-production proofreader for recruitment advertisements.",
      "You receive the FINAL advertisement image and the exact list of facts it must display.",
      "Compare ONLY spelling/wording/digits as rendered on the image against the provided facts.",
      "Report a fact as misspelledOrAlteredFacts ONLY when you can clearly read a discrepancy (quote what the image shows vs what was expected).",
      "Report missingCriticalFacts ONLY for facts with no visible representation at all.",
      "Report legibilityIssues for text that is present but too small, low-contrast, or garbled to read reliably.",
      "Never judge design, layout, or whether the facts are true — spelling fidelity and legibility only.",
      "Minor typographic reformatting (case styling of headers, punctuation spacing, reordering) is NOT a discrepancy — only changed letters, digits, or words are.",
    ].join("\n"),
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: `Expected facts:\n${expectedFactLines(facts).join("\n")}` },
          {
            type: "input_image",
            image_url: `data:image/png;base64,${finalPng.toString("base64")}`,
            detail: "high",
          },
        ],
      },
    ],
    text: { format: zodTextFormat(renderedFactCheckSchema, "kai_rendered_fact_check") },
  });

  return response.output_parsed ?? null;
}

/** Full acceptance run. QR failure is fatal upstream; vision defects drive one bounded regeneration. */
export async function runGptNativeAcceptance(
  input: GptNativeAcceptanceInput,
): Promise<GptNativeAcceptanceOutcome> {
  const qrDecodable = await verifyTrustZoneQr(
    input.finalPng,
    input.expectedQrUrl,
    input.widthPx,
    input.heightPx,
  );

  const defects: string[] = [];
  let visualQaScore: number | null = null;
  let visionChecksRan = false;
  let factCheck: RenderedFactCheck | null = null;
  let visualQa: VisualQaResult | null = null;

  try {
    factCheck = await verifyRenderedFacts(input.finalPng, input.facts);
    if (factCheck) {
      visionChecksRan = true;
      defects.push(
        ...factCheck.misspelledOrAlteredFacts.map((d) => `Spelling/fidelity: ${d}`),
        ...factCheck.missingCriticalFacts.map((d) => `Missing fact: ${d}`),
        ...factCheck.legibilityIssues.map((d) => `Legibility: ${d}`),
      );
    }
  } catch (error) {
    log.warn({ err: error }, "Rendered-fact verification unavailable — continuing without it");
  }

  try {
    const qa = getVisualQaProvider();
    if (qa) {
      visualQa = await qa.evaluate({
        imagePngBase64: input.finalPng.toString("base64"),
        archetype: "GPT_NATIVE_FULL",
        platformFormatKey: input.platformFormatKey,
        widthPx: input.widthPx,
        heightPx: input.heightPx,
      });
      visionChecksRan = true;
      visualQaScore = visualQa.overallScore;
      defects.push(...visualQa.catastrophicDefects.map((d) => `Visual QA (catastrophic): ${d}`));
      if (visualQa.overallScore < 85) {
        defects.push(`Visual QA score ${visualQa.overallScore}/100 is below the 85 publishable bar`);
        defects.push(...visualQa.defects.slice(0, 5).map((d) => `Visual QA: ${d}`));
      }
    }
  } catch (error) {
    log.warn({ err: error }, "Commercial Visual QA unavailable — continuing without it");
  }

  return {
    qrDecodable,
    visionChecksRan,
    visualQaScore,
    visualQa,
    factCheck,
    defects,
    shouldRegenerate: defects.length > 0,
  };
}

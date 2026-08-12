import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAiClient, getKaiVisionModel } from "@/server/ai/openai/openai-client";
import { AiInvalidResponseError } from "@/server/ai/openai/errors";
import { visualQaResultSchema, type VisualQaInput, type VisualQaProvider, type VisualQaResult } from "./visual-qa.schema";

/**
 * BRAIN C — real OpenAI vision implementation. Uses the same
 * responses.parse + input_image pattern the extraction engine already
 * runs against KAI_VISION_MODEL (kai-extraction-engine.ts's
 * runVisionExtraction), so image-input compatibility is proven by the
 * existing production path, not assumed.
 *
 * The prompt gives the model the rendered image PLUS expectedFacts — the
 * same canonical AdvertisementFacts the deterministic Rendering Engine
 * typeset the advertisement from (docs/010 Amendment 1). Facts on the
 * image are graded against expectedFacts, never against the model's own
 * vision/OCR reading of what a role name "should" say — the deterministic
 * fact layer is the sole authority for recruitment text; the model's job
 * is presentation quality plus literal transcription-vs-canonical checks,
 * never re-interpretation.
 */
export class KaiVisualQaProvider implements VisualQaProvider {
  readonly name = "openai";

  async evaluate(input: VisualQaInput): Promise<VisualQaResult> {
    const client = getOpenAiClient();
    const response = await client.responses.parse({
      model: getKaiVisionModel(),
      instructions: buildVisualQaInstructions(),
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                `Evaluate this rendered recruitment advertisement (archetype: ${input.archetype}, ` +
                `platform format: ${input.platformFormatKey}, ${input.widthPx}x${input.heightPx}px).\n\n` +
                "CANONICAL SOURCE FACTS (expectedFacts) — this is the ONLY authority for recruitment text on " +
                "this advertisement. Any role title, or other text, you see on the image must be checked against " +
                "this JSON literally, never against what you believe the correct/common industry term is:\n" +
                JSON.stringify(input.expectedFacts, null, 2),
            },
            {
              type: "input_image",
              image_url: `data:image/png;base64,${input.imagePngBase64}`,
              detail: "high",
            },
          ],
        },
      ],
      text: { format: zodTextFormat(visualQaResultSchema, "kai_visual_qa_result") },
    });

    const parsed = response.output_parsed;
    if (!parsed) {
      throw new AiInvalidResponseError("Visual QA returned no structured verdict.");
    }
    return parsed;
  }
}

export function buildVisualQaInstructions(): string {
  return [
    "You are KAI Visual QA — a strict commercial art director for overseas recruitment advertisements.",
    "You enforce the KAI Advertisement Composition Constitution (docs/008_ADVERTISEMENT_COMPOSITION_CONSTITUTION.md): candidate-first hierarchy, the first-second attention test, the three-second comprehension test, proportional typography, no unjustified dead canvas, agency identity in the trust footer rather than dominating the top, and a prominent contact CTA WHEN CONTACT DATA EXISTS. Where the Constitution and any other convention conflict, the Constitution wins.",
    "You are judging whether a real recruitment agency could publish this advertisement on WhatsApp, Facebook, Instagram, LinkedIn, or in print, against the standard of professional Gulf/overseas recruitment agency advertisements.",
    "Judge the advertisement WITHIN its declared archetype's own grammar: VISUAL_HERO uses a HYBRID architecture — a GPT-generated text-free creative visual canvas with ALL factual text rendered deterministically on top; the AI imagery should be materially visible and commercially important, not buried under rigid document blocks; the deterministic text should use transparent scrims, compact cards, and integrated ribbons that preserve the visual power of the AI canvas. STRUCTURED_PROFESSIONAL is card-led clarity with no photography by design; HIGH_DENSITY and DTP_NEWSPAPER are deliberately typographic recruitment forms (newspaper/print/WhatsApp circulation) where the ABSENCE of photography is the correct professional convention, exactly like real Gulf newspaper recruitment ads — never request imagery for them and never lower their imagery/attention scores for being typographic; score their typography, density, structure, and authenticity instead.",
    "Score 0-100 on each dimension. Be strict: a technically clean but commercially flat document deserves a failing score. 85 is the minimum publishable bar.",
    "Evaluate: commercial advertisement quality; attention-stopping power; immediate job clarity; immediate country clarity; visual hierarchy; typography quality; canvas utilization (dead zones are defects); relevance of imagery; image/text integration; information readability; contact CTA prominence (only when contact data is present, see FACTS-VS-PRESENTATION below); trust/verification visibility; QR integration (it must look designed-in, not a sticker); overall brand professionalism.",
    "",
    "===== FACTS VS PRESENTATION — READ CAREFULLY =====",
    "You have been given expectedFacts: the canonical, source-grounded recruitment data (job titles, country, industry, and which of salary/benefits/interview/contact were actually supplied by the recruiter). This is produced by KAI's deterministic fact layer, which is the SOLE AUTHORITY for recruitment text — never your own vision/OCR reading, and never your own judgment about what a role name 'should' say.",
    "RULE 1 — NEVER invent a factual correction. If expectedFacts.positions contains an exact string (e.g. 'Rotating Equipment Technician'), that string IS correct by definition, no matter how it reads to you or what the more common industry phrasing would be. Do not report it as a typo, do not suggest 'X instead of Y', do not put it in defects or catastrophicDefects. Comparing a canonical term against your own domain expectation is exactly the mistake this system exists to prevent.",
    "RULE 2 — Only ever compare the RENDERED text on the image against the LITERAL expectedFacts strings. If what you can read on the image matches the canonical string (allowing for case/formatting), it is correct — full stop. If it visibly, literally differs character-for-character from the canonical string (e.g. the render clipped letters, duplicated a word, or shows a different string entirely), report it in factualMismatches with the exact expected string, what you actually observed, and where on the canvas. Do NOT put this in defects/catastrophicDefects, and do not let it lower any score — factualMismatches exists precisely so a real rendering bug is reported without being confused with (or substituting for) a presentation judgment.",
    "RULE 3 — If text is too small, blurred, low-contrast, or otherwise genuinely hard to transcribe with confidence, put it in factualUncertain (with what you can make out and its location) instead of guessing or asserting a mismatch.",
    "RULE 4 — expectedFacts.salaryProvided / benefitsProvided / interviewProvided / contactProvided tell you which fields the recruiter actually supplied. When a flag is false, that field's ABSENCE from the advertisement is CORRECT and expected — it is a source-data condition, not a generation defect. Never lower any score, never add a defect, and never add a required correction because salary, benefits, interview details, or a contact CTA are missing when the corresponding *Provided flag is false. Do not invent or suggest fabricated content to fill the gap.",
    "RULE 5 — CTA prominence is judged ONLY when expectedFacts.contactProvided is true. When it is false, do not evaluate, penalize, or comment on CTA styling, button prominence, or footer contact treatment at all — score ctaScore normally on whatever trust/verification elements ARE present (agency identity, QR, registration) rather than penalizing for a CTA that has no source data to display.",
    "RULE 6 — 'ghost text artifacts' or faint text you notice near the bottom of the canvas: first check whether it matches expectedFacts.agencyName, expectedFacts.registrationNumber, or other deterministic footer content (these are legitimate, intentionally rendered text in the branding band, sometimes at lower opacity by design). If it matches or plausibly corresponds to that deterministic footer text, it is NOT a defect — do not report it as ghost/generated text. Only report ghost/gibberish text in catastrophicDefects when it is unreadable pseudo-text, corrupted glyphs, or text that does not correspond to any expectedFacts string and appears to originate from the AI-generated artwork itself, not the deterministic overlay/footer band.",
    "===== END FACTS VS PRESENTATION =====",
    "",
    "INFORMATION DEDUPLICATION — the Constitution requires a single integrated trust footer. Agency name, logo, RA number, MEA badge, and registration should appear ONCE in the footer/verification band, NOT repeated at the top of the advertisement. If you see the agency identity dominating the top AND appearing again in the footer, flag it as a defect: premium candidate-attention canvas is wasted on redundant trust elements. Exception: DTP_NEWSPAPER mastheads are a justified print convention — showing the agency name/logo centered at the top of a DTP_NEWSPAPER is CORRECT and must NOT be penalized or flagged as duplication, even though the agency also appears in the bottom band; this mirrors real Gulf newspaper recruitment advertisements.",
    "CANDIDATE HOOK — the single largest text on the canvas should be a strong, truthful, candidate-facing hook (project + destination, e.g. 'BILFINGER SHUTDOWN PROJECT — IN SAUDI ARABIA'), NOT the agency name or boilerplate. If you see a candidate-facing hook line near the top that reframes the opportunity compellingly, evaluate it positively.",
    "HEADLINE CLIPPING — check that headline text is fully visible and not truncated or running off the canvas edge. Clipped headlines are a catastrophic defect.",
    "CONTRAST AND READABILITY — agency brand colors must not damage text readability. If text is hard to read because brand colors lack contrast against their background, flag it as a defect.",
    "List concrete PRESENTATION defects only (see FACTS VS PRESENTATION above for anything about text content/correctness). For each required correction choose the single most appropriate type: REGENERATE_IMAGE only when the background imagery itself is weak or irrelevant; INCREASE_HEADLINE_EMPHASIS when the role/country does not dominate; IMPROVE_SPACING for crowding, collisions, or unused canvas; IMPROVE_CTA when contact data IS present (expectedFacts.contactProvided is true) and the contact information is too small, imbalanced, or hard to find; IMPROVE_CONTRAST when text-over-image or text-over-background separation is insufficient (scrim too weak, panel too transparent); OTHER for anything else.",
    "MANDATORY REJECTION CONDITIONS — if ANY of these is true, it MUST appear in catastrophicDefects (which blocks acceptance regardless of score): more than ~20% unjustified dead canvas; the dominant headline too small for mobile social viewing; no clear candidate-facing hook visible immediately; the output looks primarily like a report, internal memo, SaaS card, or corporate document instead of a recruitment advertisement; the agency logo illegible; the contact CTA hard to find (only applicable when expectedFacts.contactProvided is true); key recruitment information requiring careful reading before the opportunity is understood; visual hierarchy materially weaker than professional Gulf overseas-recruitment advertisements; agency identity unnecessarily repeated across both top and bottom of the advertisement (wasting premium canvas) — exception: DTP_NEWSPAPER mastheads are a justified print convention and are NOT a repetition defect; headline text clipped or truncated; or an agency would reasonably need to redesign it manually before publishing. NEVER include a factual/terminology judgment here — see RULE 1-3 above.",
    "The pass standard is commercial, not ceremonial: would a real overseas recruitment agency PAY for this advertisement and publish it directly, without manual redesign, and is it competitive with strong AI-generated and traditional overseas recruitment advertisements?",
    "ANTI-GIBBERISH — for VISUAL_HERO, the AI-generated background canvas must contain NO readable text, numbers, letters, logos, or pseudo-typographic elements. Any visible AI-generated text (corrupted words, misspellings, fake numbers, garbled letters, decorative pseudo-text, signage with readable text, equipment labels) is a CATASTROPHIC defect. The background should be purely visual: imagery, color, light, composition, atmosphere. All readable text must come from the clean deterministic overlay. This rule is about the AI ARTWORK specifically — it does not apply to the deterministic overlay/footer text, which is graded under FACTS VS PRESENTATION and RULE 6 above, not here.",
    "Separately list catastrophicDefects — defects that must block publication regardless of the overall score: unreadable position text (presentation illegibility, not a terminology disagreement), clipped content, overlapping text, apparent company logos/branding/signage rendered inside the background imagery, AI-generated gibberish text or pseudo-text visible in the background imagery (per RULE 6, first rule out deterministic footer text), any readable text that appears to come from the AI canvas rather than the deterministic overlay, severe canvas misuse (large dead zones), missing agency/verification identity elements, or agency trust elements unjustifiably repeated across the canvas. Leave the list empty when none apply.",
    "Populate factualMismatches and factualUncertain per RULE 2-3 above — independently of defects/catastrophicDefects/requiredCorrections, and never as a substitute for or influence on any score.",
    "Verdict: PASS if overallScore >= 85, REGENERATE if below 85 and correctable, BLOCKED only if the image is fundamentally broken (blank, unreadable, corrupted).",
  ].join("\n");
}

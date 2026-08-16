import { getTextGenerationProvider } from "@/server/ai/text";
import type { AdvertisementFacts } from "./types";

/**
 * ============================================================================
 * KAI CREATIVE DIRECTOR — ARTWORK ONLY
 * ============================================================================
 *
 * GEMINI owns:
 *   - visual concept, hero subject, environment, authentic human action
 *   - camera/composition, lighting, colour mood, depth, emotional tone
 *   - decorative visual elements only
 *
 * KAI owns:
 *   - ALL exact recruitment and agency text: campaign headline, country,
 *     industry, project/employer, job titles, vacancy counts, salary,
 *     benefits, interview date/venue, contact information, agency name,
 *     registration number, ISO/credential text, QR, logos
 *
 * Gemini therefore NEVER writes the advertisement copy and renders NO
 * readable text of any kind — every verified fact is typeset separately
 * and deterministically by the Fact Layer (`fact-layer.ts`), over this
 * artwork, beneath the KAI trust layer (`branding-overlay.ts`). This
 * function produces a visual art-direction brief only; the grounded
 * requirement data below is creative intelligence for choosing the right
 * scene, never copy to be printed.
 * ============================================================================
 */
export async function buildCreativeBrief(
  facts: AdvertisementFacts,
  options?: { style?: string; theme?: string },
): Promise<string> {
  const provider = getTextGenerationProvider();

  const styleHint = options?.style
    ? `Preferred visual style selected by KAI: ${options.style}.`
    : "No fixed visual style has been selected; choose the strongest professional style for the opportunity.";

  const themeHint = options?.theme
    ? `Preferred colour theme selected by KAI: ${options.theme}.`
    : "No fixed colour theme has been selected; choose a disciplined premium palette appropriate to the opportunity.";

  const { text } = await provider.generateText({
    instructions: [
      "You are KAI's senior commercial art director for international recruitment advertising.",
      "Your job is to create the visual concept that gives the final advertisement a premium, emotionally powerful, human, campaign-quality image.",
      "Use the grounded KAI requirement data below as creative intelligence only — to choose the right industry, environment and mood. It is NEVER copy to be printed.",
      "",
      "================================================================",
      "OWNERSHIP — READ FIRST",
      "================================================================",
      "GEMINI = VISUAL ARTWORK ONLY.",
      "KAI = ALL EXACT RECRUITMENT AND AGENCY TEXT.",
      "",
      "You are briefing background/visual artwork only. Every word of the finished advertisement — campaign headline, country, industry, project/employer name, job titles, vacancy counts, salary, benefits, interview date and venue, candidate contact information, agency name, registration number, ISO/credential text, and the verification QR — is typeset separately and deterministically by KAI's own rendering engine, on top of the artwork you describe. None of that text exists yet when your artwork is generated, and none of it is your job to compose, imply, or approximate.",
      "",
      "================================================================",
      "GEMINI MUST NOT RENDER",
      "================================================================",
      "No headline text. No country text. No industry text. No project/employer text.",
      "No job titles. No vacancy counts. No salary figures. No benefits text.",
      "No interview date or venue text. No contact information (phone, email, WhatsApp).",
      "No agency name. No registration number. No ISO or credential text.",
      "No QR code. No logos. No readable signage of any kind.",
      "No fake website, email or phone number rendered as if real.",
      "No watermarks. No pseudo-typography, no letters, no numbers, no documents, no screens with text, no badges.",
      "If a mark in the scene would naturally carry text (a sign, a hard-hat sticker, a vehicle livery), either omit the mark or render it as an illegible/blank surface — never invent legible wording on it.",
      "",
      "================================================================",
      "GEMINI MUST CREATE",
      "================================================================",
      "A premium recruitment visual: an authentic industry environment with workers performing believable, trade-accurate work.",
      "Real machinery, tools, PPE and architecture matched to the supplied industry and project context.",
      "A strong hero composition with clear foreground, midground and background depth — not a flat, single-plane snapshot.",
      "Deliberate, commercially useful visual hierarchy: one dominant visual idea, not a collage of unrelated scenes.",
      "Believable lighting and a disciplined, premium colour treatment.",
      "Intentional visual-safe zones the KAI text layer can sit over cleanly — calm, uncluttered regions, not a canvas that is busy edge-to-edge.",
      "Full use of the canvas: no giant empty dead space, and no generic CRM/dashboard/document appearance.",
      "The image must read as a strong, finished-looking creative canvas even before any text is added to it.",
      "",
      "================================================================",
      "LLM CREATIVE FREEDOM",
      "================================================================",
      "Within the constraints above, use full visual creativity.",
      "Think like an elite advertising creative director and editorial photographer, not like a template generator.",
      "Choose the strongest visual metaphor, hero subject, camera viewpoint, depth, scale, human action, environmental storytelling, lighting, colour grading and emotional tone for this opportunity.",
      "Make the image feel specifically art-directed for this recruitment campaign rather than like generic stock photography.",
      "You may use cinematic composition, dramatic perspective, authentic human action, atmospheric depth, premium colour separation, controlled highlights, realistic industrial detail, foreground framing, leading lines and sophisticated negative-space management whenever they improve the commercial result.",
      "A human worker is preferred whenever the requirement is an industrial or skilled-trades opportunity, but the worker must look authentic to the trade and environment rather than posed.",
      "The visual should create an immediate emotional response at mobile thumbnail size: ambition, opportunity, competence, scale, prestige, urgency, stability or earning potential, selected from what the grounded requirement actually supports.",
      "",
      "================================================================",
      "INDUSTRY AUTHENTICITY",
      "================================================================",
      "Match machinery, structures, tools, PPE, uniforms, architecture, work activity, climate and site conditions to the supplied industry and project context.",
      "For oil & gas, petrochemical, energy, construction, marine, shipyard and industrial maintenance work, show a believable working environment with scale and technical detail.",
      "For other industries, adapt the visual language accordingly rather than forcing an industrial aesthetic.",
      "",
      "================================================================",
      "OUTPUT FORMAT",
      "================================================================",
      "Return one polished visual art-direction brief in natural language.",
      "It should describe: the core visual concept; hero subject; environment; authentic action; camera/composition; lighting; colour mood; depth; emotional tone; overlay-safe zones; and negative constraints (no text/logos/QR).",
      "Do not mention internal KAI engine names, enum values or implementation details.",
      "Do not repeat the raw requirement as a data dump.",
      "Do not write advertisement copy, slogans, headlines, salary text, job lists or calls-to-action — that is exclusively KAI's job, not yours.",
      "Keep the brief decisive and image-model-ready.",
      "",
      styleHint,
      themeHint,
    ].join("\n"),

    // Decision inputs only — creative intelligence for choosing the right
    // scene, never printable copy. Gemini receives just enough of the
    // requirement to depict the correct industry, destination and work;
    // it never receives exact salary, vacancy counts, or contact/agency
    // identity, so there is nothing exact for it to be tempted to render.
    input: JSON.stringify({
      industry: facts.industry,
      country: facts.country,
      projectType: facts.projectType ?? null,
      employer: facts.employer ?? null,
      trades: facts.positions.slice(0, 8).map((p) => p.title),
      style: options?.style ?? null,
      theme: options?.theme ?? null,
    }),
  });

  return text.trim();
}

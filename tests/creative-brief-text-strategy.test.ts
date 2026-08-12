import { getTextGenerationProvider } from "@/server/ai/text";
import type { AdvertisementFacts } from "./types";

/**
 * KAI Creative Direction — visual intelligence only.
 *
 * Separation law:
 * - KAI owns grounded recruitment facts and the final factual/verification layer.
 * - The LLM owns visual creativity, art direction, emotional treatment, scene
 *   design, photography, composition and commercial visual psychology.
 * - Neither side is allowed to impersonate the other.
 *
 * This function therefore NEVER writes the advertisement copy. It produces a
 * high-quality visual art direction that the image model can interpret freely.
 * The downstream fact layer remains the sole authority for printable facts.
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
      "Use the grounded KAI requirement data as creative intelligence, not as copy to be printed.",
      "KAI owns all factual recruitment content. You own the visual idea.",
      "",
      "SEPARATION CONTRACT:",
      "Never invent, alter, estimate or embellish salary, vacancy count, job title, employer claim, benefit, interview date, interview city, contact detail, licence number, registration number or QR content.",
      "Never turn a classification or creative inference into a factual recruitment claim.",
      "Do not write advertisement copy. Do not output slogans, headlines, salary text, job lists or calls-to-action.",
      "",
      "LLM CREATIVE FREEDOM:",
      "Within those factual boundaries, use full visual creativity.",
      "Think like an elite advertising creative director and editorial photographer, not like a template generator.",
      "Choose the strongest visual metaphor, hero subject, camera viewpoint, depth, scale, human action, environmental storytelling, lighting, colour grading and emotional tone for this opportunity.",
      "Make the image feel specifically art-directed for this recruitment campaign rather than like generic stock photography.",
      "You may use cinematic composition, dramatic perspective, authentic human action, atmospheric depth, premium colour separation, controlled highlights, realistic industrial detail, foreground framing, leading lines and sophisticated negative-space management whenever they improve the commercial result.",
      "A human worker is preferred whenever the requirement is an industrial or skilled-trades opportunity, but the worker must look authentic to the trade and environment rather than posed.",
      "The visual should create an immediate emotional response at mobile thumbnail size: ambition, opportunity, competence, scale, prestige, urgency, stability or earning potential, selected from what the grounded requirement actually supports.",
      "",
      "COMMERCIAL COMPOSITION:",
      "Design one dominant visual idea. Do not create a collage of unrelated scenes.",
      "Create clear foreground, subject and background separation.",
      "Use the real canvas intelligently; avoid both empty dead space and visual clutter.",
      "Reserve intentional, visually compatible zones for the deterministic KAI information layer, but do not turn the artwork into a rigid poster template.",
      "The image must still look strong before the KAI factual layer is added.",
      "Prefer asymmetry, depth and editorial composition over generic centred stock-photo framing.",
      "",
      "INDUSTRY AUTHENTICITY:",
      "Match machinery, structures, tools, PPE, uniforms, architecture, work activity, climate and site conditions to the supplied industry and project context.",
      "For oil & gas, petrochemical, energy, construction, marine, shipyard and industrial maintenance work, show a believable working environment with scale and technical detail.",
      "For other industries, adapt the visual language accordingly rather than forcing an industrial aesthetic.",
      "",
      "TEXT / BRANDING SAFETY:",
      "Do not render readable text, letters, numbers, logos, fake company marks, flags, QR codes, watermarks, signage, screens with text, documents, badges or pseudo-typography.",
      "The image is a clean creative canvas. All readable recruitment facts, agency identity, legal information and verification elements are supplied by KAI elsewhere.",
      "",
      "OUTPUT FORMAT:",
      "Return one polished visual art-direction brief in natural language.",
      "It should describe: the core visual concept; hero subject; environment; authentic action; camera/composition; lighting; colour mood; depth; emotional tone; overlay-safe zones; and negative constraints.",
      "Do not mention internal KAI engine names, enum values or implementation details.",
      "Do not repeat the raw requirement as a data dump.",
      "Keep the brief decisive and image-model-ready.",
      "",
      styleHint,
      themeHint,
    ].join("\n"),

    input: JSON.stringify({
      // Grounded KAI schema. These are decision inputs, not printable copy.
      industry: facts.industry,
      country: facts.country,
      projectType: facts.projectType,
      positions: facts.positions.map((p) => p.title),
      benefits: facts.benefits,
      interview: facts.interview,
      employer: facts.employer,
      style: options?.style ?? null,
      theme: options?.theme ?? null,
    }),
  });

  return text.trim();
}

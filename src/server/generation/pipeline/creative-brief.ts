import { getTextGenerationProvider } from "@/server/ai/text";
import type { AdvertisementFacts } from "./types";

/**
 * KAI writes ONE creative brief for the BACKGROUND ARTWORK ONLY.
 *
 * The image model owns atmosphere, photography, industrial environment,
 * workers, lighting, depth and visual composition.
 *
 * All trusted recruitment facts — headline, employer, job titles, counts,
 * salaries, benefits, dates, contacts, licence and QR — are rendered
 * deterministically by the Fact Layer / Branding Engine.
 */
export async function buildCreativeBrief(
  facts: AdvertisementFacts,
  options?: { style?: string; theme?: string },
): Promise<string> {
  const provider = getTextGenerationProvider();

  const styleHint = options?.style
    ? `Preferred visual style: ${options.style}. `
    : "";

  const themeHint = options?.theme
    ? `Preferred colour theme: ${options.theme}. `
    : "";

  const { text } = await provider.generateText({
    instructions:
      "You are the senior art director for a premium international recruitment " +
      "advertisement for major Gulf industrial projects. " +
      "The image you create is the BACKGROUND ARTWORK ONLY. " +

      "\n\nFACTUAL INTEGRITY LAW: " +
      "Every trusted fact in the advertisement — headline, employer name, job titles, " +
      "vacancy counts, salaries, benefits, dates, interview details, contact details, " +
      "licence numbers, registration information and QR codes — is rendered separately " +
      "and deterministically by the KAI Rendering Engine. " +
      "The image model must NOT render those facts. " +

      "\n\nTherefore NEVER render readable text, letters, numbers, logos, badges, " +
      "QR codes, signage, documents, screens containing text, watermarks or fake branding. " +
      "Describe only the visual artwork: environment, workers, equipment, trade activity, " +
      "architecture, machinery, lighting, atmosphere, depth, perspective and colour grade. " +

      styleHint +
      themeHint +

      "\n\nCREATIVE DIRECTION: " +
      "Create a strong, premium recruitment campaign hero — not a blank background. " +
      "The first impression must immediately communicate the real industry, the scale of " +
      "the project and the professional nature of the opportunity. " +

      "\n\nHARD CONTENT REQUIREMENT: " +
      "The artwork is invalid unless it contains at least one clearly visible human industrial worker. " +
      "The worker must be in the foreground or midground, not a tiny distant figure, and should occupy " +
      "approximately 20–30% of the hero height. " +
      "The worker must be visibly wearing realistic industrial PPE appropriate to the trade. " +
      "For oil-and-gas or maintenance requirements, show an actual maintenance worker actively working " +
      "within a recognisable refinery, process plant or industrial maintenance environment. " +
      "A refinery-only establishing shot without a clearly visible worker is NOT acceptable. " +

      "\n\nFor oil-and-gas, energy, petrochemical, construction, marine or industrial " +
      "requirements, show an authentic working environment: realistic industrial structures, " +
      "process equipment, maintenance activity, workers in correct PPE, machinery, access " +
      "systems and believable site conditions. " +
      "Never use generic corporate abstractions or posed stock-photo behaviour. " +

      "\n\nCOMPOSITION: " +
      "Keep approximately the upper 25% visually calm enough to support the deterministic " +
      "headline overlay, but do NOT leave a large empty central area. " +
      "Use the majority of the hero actively. " +
      "Place the primary worker or industrial focal subject prominently in the right third " +
      "or slightly right-of-centre. " +
      "The worker must be clearly visible, large enough to read immediately on a phone, " +
      "and must not be cropped awkwardly at the bottom. " +

      "\n\nBuild visual depth using foreground, midground and background elements. " +
      "Use cinematic but believable natural lighting, realistic scale, atmospheric depth, " +
      "controlled contrast and premium editorial photography. " +
      "The image should feel like a professionally art-directed campaign for a major Gulf " +
      "industrial project, not a generic stock image. " +

      "\n\nThe lowest approximately 15% should remain comparatively simple so the KAI Fact Layer " +
      "can safely occupy that region, but there must be NO huge dead zone above it. " +

      "\n\nSOCIAL-FIRST QUALITY BAR: " +
      "The advertisement will be viewed mainly on phones through WhatsApp, Instagram, " +
      "Facebook, LinkedIn and Telegram. " +
      "Create immediate visual impact, one dominant focal subject, strong depth, authentic " +
      "industrial detail and a composition that remains compelling at thumbnail size. " +
      "Avoid tiny details that disappear after compression. " +

      "\n\nVISUAL AVOIDANCE: " +
      "No stock-photo handshake, no posed office portrait, no smiling corporate team, " +
      "no abstract blue technology background, no empty skyline, no giant empty sky, " +
      "no refinery-only establishing shot, no worker reduced to a tiny background figure, " +
      "no random construction cranes without context, no decorative fantasy machinery, " +
      "no flags or national symbols, no generic businessman imagery. " +

      "\n\nTRUTHFUL ENVIRONMENT: " +
      "The artwork must match the industry, country and project type supplied below. " +
      "Use realistic PPE, climate, site conditions, machinery and architecture appropriate " +
      "to the described industry and destination. " +

      "\n\nSUBJECT PRIORITY: " +
      "When a human worker is present, the worker is the primary visual subject and the " +
      "industrial environment is the supporting context. " +
      "Prefer authentic action — inspection, maintenance, welding, fitting, operations, " +
      "supervision or another clearly believable task — rather than standing and posing. " +

      "\n\nDO NOT SOLVE THE ADVERTISEMENT WITH EMPTY SPACE: " +
      "Whitespace is allowed only where it improves factual readability. " +
      "Do not interpret 'clean' or 'premium' as an instruction to remove the worker, " +
      "industrial activity or visual energy. " +

      "\n\nThe output should be ONE concise paragraph of visual direction for the image model. " +
      "Do not list facts. Do not write advertising copy. " +
      "Do not describe layout coordinates for the factual text beyond the safe compositional " +
      "guidance already provided.",

    input: JSON.stringify({
      industry: facts.industry,
      country: facts.country,
      projectType: facts.projectType,
      trades: facts.positions.slice(0, 10).map((p) => p.title),
    }),
  });

  return text;
}

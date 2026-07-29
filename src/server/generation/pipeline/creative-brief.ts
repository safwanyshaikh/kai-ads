import { getTextGenerationProvider } from "@/server/ai/text";
import type { AdvertisementFacts } from "./types";

/**
 * KAI writes ONE brief, and under the Factual Integrity Law (docs/010
 * Amendment 1) it briefs the BACKGROUND ARTWORK ONLY.
 *
 * Every word a candidate must be able to trust — headline, job titles,
 * salaries, benefits, dates, contacts, licence — is typeset deterministically
 * by the Rendering Engine (fact-layer.ts + branding-overlay.ts) on top of
 * this artwork. The image model is therefore instructed to render no text at
 * all, which removes the entire class of defects that model-rendered facts
 * produced: dropped roles, invented roles, broken numbering, garbled strings.
 *
 * The facts are still passed as input, because the artwork must truthfully
 * depict the right industry, destination and work — but never to be printed.
 */
export async function buildCreativeBrief(
  facts: AdvertisementFacts,
  options?: { style?: string; theme?: string },
): Promise<string> {
  const provider = getTextGenerationProvider();

  const styleHint = options?.style ? `Preferred visual style: ${options.style}. ` : "";
  const themeHint = options?.theme ? `Preferred colour theme: ${options.theme}. ` : "";

  const { text } = await provider.generateText({
    instructions:
      "You are an art director briefing a photographic image model for a professional overseas-recruitment " +
      "advertisement in the Gulf/GCC market. " +
      "\n\nCRITICAL: you are briefing the BACKGROUND ARTWORK ONLY. Every word of the advertisement — headline, " +
      "job titles, salaries, benefits, dates, contact details, licence number — is typeset separately and " +
      "deterministically on top of the artwork you describe. " +
      "\n\nTherefore: instruct the image model to render NO text, NO letters, NO numbers, NO logos, NO badges, " +
      "NO signage, NO documents, NO screens showing writing, and NO QR codes. Any text it renders is a defect " +
      "and will be covered over. Describe only: the scene, the workers and their real trade activity, the " +
      "environment, time of day, lighting, atmosphere, depth and colour grade. " +
      styleHint + themeHint +
      "\n\nComposition constraints, which exist because text is placed over this artwork: keep the upper 40% of " +
      "the frame visually calm and uncluttered (open sky, haze, a clear horizon) so headline text stays legible " +
      "over it; avoid any bright or high-contrast focal point in the lower 60%; keep the main subject toward " +
      "the right third of the frame; and leave the bottom edge quiet. " +
      "\n\nThe scene must truthfully depict the industry and destination in the data below — real work, real " +
      "protective equipment, real site conditions, real climate. Photographic realism, editorial quality, " +
      "natural light. No stock-photo handshakes, no posed studio portraits, no corporate abstractions, no " +
      "flags or national symbols. " +
      "\n\nThese advertisements are published mainly to Instagram, Facebook, LinkedIn, WhatsApp and " +
      "Telegram, and are read on a phone before anywhere else. Favour a modern, clean, social-first " +
      "composition over a print-first one: strong immediate focal point, generous whitespace, high " +
      "contrast that survives feed compression, and nothing so fine or busy that it disappears at " +
      "thumbnail size. It must still hold up when downloaded, printed or exported to PDF. " +
      "This is an objective, not a layout — decide the composition yourself. " +
      "\n\nWrite one paragraph of visual direction. Do not list facts. Do not write advertising copy.",
    input: JSON.stringify({
      industry: facts.industry,
      country: facts.country,
      projectType: facts.projectType,
      trades: facts.positions.slice(0, 8).map((p) => p.title),
    }),
  });

  return text;
}

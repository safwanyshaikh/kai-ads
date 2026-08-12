import { getTextGenerationProvider } from "@/server/ai/text";
import type { AdvertisementFacts } from "./types";

/**
 * KAI CREATIVE DIRECTOR
 *
 * Responsibility split:
 *
 * CREATIVE LLM:
 *   - campaign concept
 *   - visual story
 *   - hero subject
 *   - emotional direction
 *   - photography direction
 *   - camera / perspective
 *   - lighting
 *   - colour mood
 *   - environment
 *   - visual hierarchy
 *   - commercial attention strategy
 *
 * KAI:
 *   - exact recruitment facts
 *   - exact job titles
 *   - exact counts
 *   - exact salary/benefit information
 *   - exact dates
 *   - exact contact information
 *   - exact registration / QR
 *
 * The LLM must never invent or render trusted recruitment text.
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

  const positions = facts.positions
    .slice(0, 12)
    .map((position) => ({
      title: position.title,
      count: position.count ?? null,
    }));

  const benefits = facts.benefits
    .slice(0, 8)
    .map((benefit) => ({
      label: benefit.label,
      detail: benefit.detail ?? null,
    }));

  const interview = facts.interview
    .slice(0, 2)
    .map((event) => ({
      date: event.date ?? null,
      location: event.location ?? null,
    }));

  const creativeContext = {
    employer: facts.employer,
    country: facts.country,
    industry: facts.industry,
    projectType: facts.projectType,
    header: facts.header,
    visaType: facts.visaType,
    dutyHours: facts.dutyHours,
    rotation: facts.rotation,
    positions,
    benefits,
    interview,
  };

  const { text } = await provider.generateText({
    instructions:
      "You are KAI's senior commercial Creative Director for premium international " +
      "recruitment campaigns in the GCC and overseas employment market. " +

      "\n\nYOUR JOB: " +
      "Design the creative concept for the advertisement, not a generic background. " +
      "Think like a top advertising art director, photographer, campaign strategist and " +
      "visual storyteller working together. " +

      "\n\nTHE FINAL ADVERTISEMENT HAS TWO PARALLEL SYSTEMS: " +
      "1. The creative system is controlled by the image model. " +
      "2. The factual system is controlled deterministically by KAI. " +
      "They must complement each other, never compete or duplicate one another. " +

      "\n\nCREATIVE SYSTEM — YOU CONTROL: " +
      "hero concept, visual story, emotional hook, primary subject, human presence, " +
      "environment, camera perspective, depth, lighting, colour, atmosphere, realism, " +
      "commercial energy, visual hierarchy and mobile attention. " +

      "\n\nFACTUAL SYSTEM — KAI CONTROLS: " +
      "headline text, employer name, job titles, vacancy counts, salaries, benefits, " +
      "interview information, dates, contacts, registration details and QR. " +

      "\n\nNEVER RENDER TRUSTED TEXT: " +
      "Do not generate readable advertising copy, vacancy numbers, salaries, dates, " +
      "phone numbers, email addresses, QR codes, registration numbers, fake company logos, " +
      "watermarks, pseudo-text, fake UI, documents with readable writing or artificial signage. " +
      "The final factual information will be added by KAI after the image is generated. " +

      styleHint +
      themeHint +

      "\n\nCREATIVE STANDARD: " +
      "The output must feel like a premium paid recruitment campaign created by an expert " +
      "advertising agency for a major Gulf industrial employer. " +
      "It must NOT resemble a generic stock photo, SaaS banner, corporate presentation, " +
      "internal memo, poster template or empty background. " +

      "\n\nPRIMARY VISUAL HOOK: " +
      "Create one unmistakable dominant visual subject that communicates the opportunity " +
      "within the first second on a phone screen. " +
      "Where industrial workers are relevant, use an authentic worker as the hero subject " +
      "and make that person clearly visible in the foreground or strong midground. " +

      "\n\nHUMAN AUTHENTICITY: " +
      "Workers must look like real professionals performing believable industrial work. " +
      "Use realistic PPE, equipment, posture, tools, environment and scale. " +
      "Prefer authentic action such as inspection, maintenance, welding, fitting, operations, " +
      "supervision or technical work rather than posing for a camera. " +

      "\n\nINDUSTRIAL AUTHENTICITY: " +
      "The environment must visually match the actual industry, project type and destination. " +
      "Use believable refinery/process equipment, construction systems, marine structures, " +
      "workshops, shutdown environments, machinery, access systems and site conditions where appropriate. " +

      "\n\nCOMMERCIAL COMPOSITION: " +
      "Create a deliberate foreground, midground and background. " +
      "Use cinematic depth, realistic perspective, strong subject separation and professional lighting. " +
      "Do not create a giant empty sky or a large dead centre merely because KAI will add factual information. " +
      "Negative space may exist only where it improves readability without weakening the advertisement. " +

      "\n\nMOBILE-FIRST ATTENTION: " +
      "The advertisement will be consumed primarily through WhatsApp, Instagram, Facebook, LinkedIn " +
      "and Telegram. The image must remain compelling when reduced to thumbnail size. " +
      "Prioritise one dominant subject, clear silhouette, strong contrast, depth and immediate recognition. " +

      "\n\nCAMPAIGN FEEL: " +
      "The visual should communicate professionalism, scale, opportunity, technical competence, " +
      "trust and ambition without relying on flags, generic national symbolism or clichéd corporate imagery. " +

      "\n\nDO NOT DUPLICATE KAI: " +
      "Do not design boxes, tables, vacancy lists, salary panels, QR areas, registration panels, " +
      "agency footers or detailed textual layouts. KAI handles those facts after the image is produced. " +

      "\n\nIMPORTANT: " +
      "Do not interpret 'clean', 'premium' or 'professional' as instructions to remove people, " +
      "industrial activity or visual energy. The creative must remain visually rich and commercially strong. " +

      "\n\nOUTPUT: " +
      "Write ONE highly specific visual direction paragraph for the Gemini image model. " +
      "Describe the campaign concept, hero subject, action, environment, camera perspective, " +
      "lighting, depth, colour mood and emotional effect. " +
      "Do not write advertising copy. " +
      "Do not output lists. " +
      "Do not repeat the factual recruitment information as prose.",

    input: JSON.stringify(creativeContext),
  });

  return text;
}

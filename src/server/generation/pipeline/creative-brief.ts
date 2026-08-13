import { getTextGenerationProvider } from "@/server/ai/text";
import type { AdvertisementFacts } from "./types";

/**
 * KAI CREATIVE SCHEMA
 *
 * The production advertisement uses two commercial creative grammars:
 *
 * 1. HERO_RECRUITMENT_POSTER
 *    Focused / moderate recruitment requirement.
 *
 * 2. HIGH_DENSITY_RECRUITMENT_POSTER
 *    Large recruitment requirement.
 *
 * Gemini owns the complete advertisement composition.
 * KAI owns source-grounded recruitment intelligence and trust rules.
 */
export async function buildCreativeBrief(
  facts: AdvertisementFacts,
  options?: {
    style?: string;
    theme?: string;
  },
): Promise<string> {
  const provider =
    getTextGenerationProvider();

  const roleCount =
    facts.positions.length;

  const totalVacancies =
    facts.positions.reduce(
      (sum, position) =>
        sum +
        (position.count ?? 0),
      0,
    );

  const archetype =
    roleCount <= 7
      ? "HERO_RECRUITMENT_POSTER"
      : "HIGH_DENSITY_RECRUITMENT_POSTER";

  const styleHint =
    options?.style
      ? options.style
      : "Choose the strongest premium commercial visual style appropriate to the recruitment campaign.";

  const themeHint =
    options?.theme
      ? options.theme
      : "Choose a professional visual colour system appropriate to the industry and recruitment campaign.";

  /**
   * COMPLETE SOURCE-GROUNDED CONTENT PACKET.
   *
   * Do not reduce this to first-N positions.
   */
  const canonicalContent = {
    headline:
      facts.header,

    country:
      facts.country,

    industry:
      facts.industry,

    employer:
      facts.employer ??
      null,

    projectType:
      facts.projectType ??
      null,

    visaType:
      facts.visaType ??
      null,

    dutyHours:
      facts.dutyHours ??
      null,

    rotation:
      facts.rotation ??
      null,

    totalVacancies,

    totalDistinctRoles:
      roleCount,

    positions:
      facts.positions.map(
        (position) => ({
          title:
            position.title,

          count:
            position.count ??
            null,

          experience:
            position.experience ??
            null,

          salary:
            position.salary ??
            null,

          qualification:
            position.qualification ??
            null,

          certifications:
            position.certifications ??
            [],

          ageLimit:
            position.ageLimit ??
            null,
        }),
      ),

    benefits:
      facts.benefits.map(
        (benefit) => ({
          label:
            benefit.label,

          detail:
            benefit.detail ??
            null,
        }),
      ),

    interview:
      facts.interview.map(
        (event) => ({
          date:
            event.date ??
            null,

          location:
            event.location ??
            null,
        }),
      ),

    contact:
      facts.contact,

    officeAddress:
      facts.officeAddress ??
      null,

    website:
      facts.website ??
      null,

    legalDisclaimer:
      facts.legalDisclaimer ??
      null,

    footer:
      facts.footer ??
      null,

    agencyName:
      facts.agencyName,

    raLicenseId:
      facts.raLicenseId ??
      null,

    fullRegistrationNumber:
      facts.fullRegistrationNumber ??
      null,
  };

  const { text } =
    await provider.generateText({
      instructions:
        [
          "You are KAI's Senior Creative Director for a serious overseas recruitment agency.",

          "",

          "Your job is to design the COMPLETE COMMERCIAL RECRUITMENT ADVERTISEMENT.",

          "This is NOT a background-image task.",
          "This is NOT a document.",
          "This is NOT a spreadsheet.",
          "This is NOT an internal requirement sheet.",
          "This is NOT a SaaS dashboard.",
          "This is NOT a generic AI poster.",

          "",

          "KAI CREATIVE SCHEMA:",

          `ARCHETYPE: ${archetype}`,
          `STYLE: ${styleHint}`,
          `THEME: ${themeHint}`,

          "",

          "The final advertisement must look like a real overseas recruitment campaign created by a professional advertising team.",

          "",

          "FIRST-SECOND ATTENTION:",
          "The dominant candidate-facing hook must stop the scroll immediately.",
          "The largest typography must communicate the recruitment opportunity.",
          "The agency must never dominate the top of the advertisement.",

          "",

          "THREE-SECOND COMPREHENSION:",
          "A relevant candidate should quickly understand:",
          "what the opportunity is,",
          "where it is,",
          "what industry/project it belongs to,",
          "what roles are being recruited,",
          "and how to act when valid contact/interview information exists.",

          "",

          "HERO_RECRUITMENT_POSTER:",
          "Use one dominant visual hero.",
          "Use large editorial headline typography.",
          "Make the country and project obvious.",
          "Present the roles in a concise readable structure.",
          "Use real benefits/interview/contact information when supplied.",
          "Finish with compact agency trust architecture.",

          "",

          "HIGH_DENSITY_RECRUITMENT_POSTER:",
          "This is still a commercial advertisement.",
          "It must NOT look like a spreadsheet.",
          "It must NOT become a database-style list.",
          "Group roles intelligently into visually meaningful recruitment sections.",
          "Use clear categories, bands, columns or grouped role blocks when helpful.",
          "Maintain a strong visual hero.",
          "Maintain large readable typography.",
          "Never solve density by shrinking everything into microscopic text.",

          "",

          "INDUSTRY RECOGNITION:",
          "Oil & Gas must look like Oil & Gas.",
          "Construction must look like Construction.",
          "Shipyard and Marine must look like Shipyard and Marine.",
          "Manufacturing must look like Manufacturing.",
          "Healthcare must look like Healthcare.",
          "Hospitality must look like Hospitality.",
          "Agriculture must look like Agriculture.",
          "Energy and Power must look like Energy and Power.",

          "",

          "VISUAL HERO:",
          "Choose a dominant worker, professional, machine, environment or work action.",
          "Prefer active authentic work over posed portraits.",
          "Use realistic PPE, tools, machinery and working conditions.",
          "The visual hero must be recognisable on a mobile phone.",
          "Create convincing foreground, midground and background depth.",
          "Use deliberate camera perspective and premium editorial lighting.",

          "",

          "VISUAL STORY:",
          "The environment must tell the industry story without requiring the candidate to read the role list.",
          "The creative should communicate professional opportunity, scale, technical credibility and real work.",

          "",

          "TYPOGRAPHY LAW:",
          "Typography hierarchy must be obvious.",
          "HOOK >> DESTINATION / PROJECT >> ROLE GROUPS >> BENEFITS / INTERVIEW / CTA >> TRUST.",
          "The main hook must be large.",
          "Role text must remain comfortably readable.",
          "Do not shrink text merely to fit excessive information.",

          "",

          "CONTENT DENSITY:",
          "First understand the complete recruitment requirement.",
          "Then determine how much information a strong advertisement can communicate without damaging readability.",
          "Use the high-density grammar when necessary.",
          "Do not silently delete roles.",
          "Do not use '+ more roles'.",

          "",

          "SOURCE-GROUNDED ROLE COVERAGE:",
          "Every supplied position is part of the recruitment intelligence.",
          "Never invent a role.",
          "Never rename a role into a different occupation.",
          "You may visually group roles only when the grouping preserves the actual source meaning.",

          "",

          "FACTUAL LAW:",
          "The canonical content packet below is the only recruitment source of truth.",
          "Use exact supplied role titles.",
          "Use exact supplied vacancy counts.",
          "Use exact supplied salary information only when present.",
          "Use exact supplied benefits only when present.",
          "Use exact supplied interview information only when present.",
          "Use exact supplied contact information only when present.",
          "Never invent missing facts.",

          "",

          "SOURCE-DATA ABSENCE:",
          "Missing salary is not an invitation to invent salary.",
          "Missing benefits are not an invitation to invent benefits.",
          "Missing interview information is not an invitation to invent an interview.",
          "Missing contact information is not an invitation to invent contact information.",

          "",

          "AGENCY TRUST:",
          "Agency identity supports credibility but does not dominate the recruitment opportunity.",
          "Logo, registration, verification and agency identity belong in the trust architecture.",
          "Do not invent registration numbers.",
          "Do not invent QR codes.",
          "Do not invent agency badges.",

          "",

          "CTA:",
          "When genuine contact or interview information exists, give it strong candidate-facing prominence.",
          "CTA must feel like a designed recruitment action rather than tiny body copy.",

          "",

          "MOBILE-FIRST:",
          "The advertisement must work on WhatsApp, Instagram, Facebook, LinkedIn and Telegram.",
          "The primary hook must survive thumbnail viewing.",
          "Critical role information must remain readable.",
          "Do not use microscopic typography.",
          "Do not waste the canvas with large empty areas.",

          "",

          "VISUAL QUALITY BAR:",
          "Premium editorial advertising photography.",
          "Authentic people.",
          "Authentic work.",
          "Authentic industry.",
          "Believable scale.",
          "Controlled colour.",
          "Strong camera composition.",
          "Commercial visual impact.",

          "",

          "DO NOT FALL INTO TEMPLATE BEHAVIOUR:",
          "Do not create generic cards everywhere.",
          "Do not create a document converted into a poster.",
          "Do not cover the photograph with an oversized dark information sheet.",
          "Do not make the agency the visual hero.",
          "Do not make all typography tiny.",
          "Do not make all text the same size.",

          "",

          "IMPORTANT ARCHITECTURE:",
          "Gemini owns the complete advertisement composition.",
          "KAI supplies the complete source-grounded recruitment intelligence and creative strategy.",
          "The downstream KAI branding layer must remain minimal and should not rebuild the recruitment body.",

          "",

          "OUTPUT:",
          "Return ONE detailed creative direction paragraph for the Gemini image model.",
          "Describe the finished advertisement concept, visual hero, environment, hierarchy, typography strategy, role-group strategy, CTA/trust placement, lighting, colour, depth and mobile behaviour.",
          "Do not reproduce the role list as prose.",
          "Do not create a table.",
          "Do not output software instructions.",
        ].join(
          "\n",
        ),

      input:
        JSON.stringify({
          creativeArchetype:
            archetype,

          canonicalContent,
        }),
    });

  return text;
}

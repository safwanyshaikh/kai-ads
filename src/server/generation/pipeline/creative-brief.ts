import { getTextGenerationProvider } from "@/server/ai/text";
import type { AdvertisementFacts } from "./types";

/**
 * KAI CREATIVE SCHEMA
 *
 * The production advertisement has exactly two commercial grammars:
 *
 * 1. HERO_RECRUITMENT_POSTER
 *    For focused / moderate requirements.
 *    Strong hero photography, large hook, readable roles, benefits,
 *    interview/contact and compact trust architecture.
 *
 * 2. HIGH_DENSITY_RECRUITMENT_POSTER
 *    For large recruitment requirements.
 *    Still a real advertisement — NOT a spreadsheet.
 *    Roles are intelligently grouped into readable visual sections.
 *
 * Gemini owns the COMPLETE advertisement composition.
 *
 * KAI owns:
 * - factual truth
 * - source-grounded content
 * - campaign strategy
 * - agency trust rules
 *
 * The renderer must NOT rebuild the advertisement body afterwards.
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

  /**
   * ONLY TWO PRODUCTION CREATIVE GRAMMARS.
   */
  const archetype =
    roleCount <= 7
      ? "HERO_RECRUITMENT_POSTER"
      : "HIGH_DENSITY_RECRUITMENT_POSTER";

  const styleHint =
    options?.style
      ? options.style
      : "Choose the strongest premium commercial recruitment style appropriate to the industry.";

  const themeHint =
    options?.theme
      ? options.theme
      : "Choose a professional visual colour system appropriate to the campaign and agency identity.";

  /**
   * EXACT SOURCE-GROUNDED CONTENT PACKET.
   *
   * Nothing downstream may invent facts that are absent here.
   */
  const canonicalContent = {
    headline:
      facts.header,

    country:
      facts.country,

    industry:
      facts.industry,

    employer:
      facts.employer ?? null,

    projectType:
      facts.projectType ?? null,

    visaType:
      facts.visaType ?? null,

    dutyHours:
      facts.dutyHours ?? null,

    rotation:
      facts.rotation ?? null,

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

          mode:
            event.mode ??
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

          "Your job is NOT to create a background image.",
          "Your job is to design the COMPLETE COMMERCIAL RECRUITMENT ADVERTISEMENT.",
          "Think exactly as a top-tier human advertising creative director would when receiving a recruitment brief.",

          "",

          "KAI CREATIVE SCHEMA:",
          `ARCHETYPE: ${archetype}`,
          `STYLE: ${styleHint}`,
          `THEME: ${themeHint}`,

          "",

          "The final output must look like a real recruitment advertisement that an overseas recruitment agency would publish directly to candidates.",

          "It must NOT look like:",
          "- a requirement document",
          "- a spreadsheet",
          "- an internal report",
          "- a SaaS dashboard",
          "- a database screen",
          "- a generic AI poster",
          "- a photo with text mechanically pasted over it",

          "",

          "DESIGN THE ADVERTISEMENT AS ONE COHERENT CREATIVE.",

          "",

          "FIRST-SECOND ATTENTION:",
          "The dominant candidate-facing hook must stop scrolling immediately.",
          "The largest visual and largest typography must serve the recruitment opportunity, not the agency.",
          "The country and opportunity must be understood immediately.",

          "",

          "THREE-SECOND COMPREHENSION:",
          "A relevant candidate must quickly understand:",
          "1. what opportunity is available",
          "2. where it is",
          "3. what industry/project it belongs to",
          "4. what type of roles are available",
          "5. how to act when genuine contact/interview information exists",

          "",

          "ARCHETYPE RULE — HERO_RECRUITMENT_POSTER:",
          "Use a dominant human/worker/project visual.",
          "Use large editorial headline typography.",
          "Use a strong destination/project treatment.",
          "Use a readable compact role section.",
          "Use genuine benefits/interview/contact information when supplied.",
          "Use a compact agency trust footer.",
          "Use large readable text — never tiny text.",

          "",

          "ARCHETYPE RULE — HIGH_DENSITY_RECRUITMENT_POSTER:",
          "This is still a premium advertisement, not a spreadsheet.",
          "Use a strong hero visual and strong headline hierarchy.",
          "Group roles intelligently by commercial relevance or natural trade families.",
          "Use visually separated recruitment sections rather than 19 microscopic rows.",
          "Use category headings when they improve scanability.",
          "Use role clusters, columns, badges, bands or panels only as genuine advertising design elements.",
          "Typography must remain readable on a phone.",
          "Never solve density by shrinking every role into tiny text.",
          "If the supplied requirement is large, make the information architecture sophisticated rather than document-like.",

          "",

          "VERY IMPORTANT:",
          "The final advertisement must resemble a professionally designed recruitment campaign.",
          "Study the visual logic of high-performing recruitment posters: strong hook, destination, project/industry, visual hero, clear role communication, benefits/interview/action and compact trust architecture.",

          "",

          "VISUAL INDUSTRY RECOGNITION:",
          "The industry must be recognisable from the actual imagery.",
          "Oil & Gas must look like Oil & Gas.",
          "Construction must look like Construction.",
          "Shipyard / Marine must look like Shipyard / Marine.",
          "Manufacturing must look like Manufacturing.",
          "Healthcare must look like Healthcare.",
          "Hospitality must look like Hospitality.",
          "Agriculture must look like Agriculture.",
          "Energy / Power must look like Energy / Power.",

          "",

          "HERO VISUAL:",
          "Choose one dominant worker, professional, machine, environment or work action.",
          "Prefer active authentic work over posing.",
          "Use realistic PPE and equipment.",
          "Make the subject visually important enough for mobile viewing.",
          "Build real foreground, midground and background depth.",
          "Use deliberate camera composition.",
          "Use premium editorial lighting.",
          "Use realistic scale and believable site conditions.",

          "",

          "TYPOGRAPHY:",
          "Typography is part of the advertisement design.",
          "Do not make all text the same size.",
          "Use a clear hierarchy:",
          "HOOK >> DESTINATION / PROJECT >> ROLE GROUPS >> BENEFITS / INTERVIEW / CTA >> TRUST",
          "Primary headline must be large.",
          "Role text must be comfortably readable.",
          "Do not create microscopic text simply to fit every field.",

          "",

          "CONTENT COVERAGE:",
          "Every supplied recruitment role must influence the advertisement concept.",
          "Do not silently delete positions.",
          "Do not replace roles with '+ more roles'.",
          "Do not invent category names that change the meaning of the source.",
          "You may group roles visually when grouping preserves the source meaning.",

          "",

          "FACTUAL LAW:",
          "The canonical content packet below is the ONLY source of recruitment truth.",
          "Use exact supplied role titles.",
          "Use exact supplied counts.",
          "Use exact supplied salaries only when present.",
          "Use exact supplied benefits only when present.",
          "Use exact supplied interview details only when present.",
          "Use exact supplied contact details only when present.",
          "Use exact supplied employer/project information only when present.",
          "Never invent missing information.",

          "",

          "SOURCE-DATA ABSENCE:",
          "If salary is absent, do not invent a salary.",
          "If benefits are absent, do not invent benefits.",
          "If interview details are absent, do not invent an interview.",
          "If contact information is absent, do not invent contact information.",
          "The advertisement should simply use the information that genuinely exists.",

          "",

          "AGENCY TRUST:",
          "Agency identity supports trust but does not dominate the advertisement.",
          "Keep the agency logo/name/registration/verification toward the trust/footer area unless a stronger source-grounded reason exists.",
          "Never create a fake agency badge.",
          "Never invent a registration number.",
          "Never invent QR content.",

          "",

          "CTA:",
          "Use a strong candidate action area when genuine contact/interview/application information exists.",
          "CTA should look designed, not like a tiny email line.",
          "Never invent candidate action data.",

          "",

          "MOBILE-FIRST:",
          "The advertisement must remain effective on a phone.",
          "The hook must survive thumbnail viewing.",
          "Important role text must remain readable.",
          "Do not hide critical information behind tiny typography.",
          "Do not create huge dead zones.",

          "",

          "NO GENERIC AI POSTER LANGUAGE:",
          "Do not automatically use phrases like:",
          "EXCITING OPPORTUNITIES AWAIT YOU",
          "JOIN OUR TEAM",
          "BUILD YOUR FUTURE",
          "unless the supplied campaign facts genuinely support them and they improve the commercial concept.",
          "Prefer the actual recruitment proposition.",

          "",

          "IMPORTANT ARCHITECTURE RULE:",
          "Gemini owns the complete advertisement composition.",
          "Do not expect KAI to place the entire job list afterwards.",
          "The final image should already be a complete advertisement.",
          "KAI's downstream branding stage is only for controlled agency trust/verification elements.",

          "",

          "OUTPUT:",
          "Return one detailed creative direction for the Gemini image model.",
          "It must describe the finished advertisement concept, hierarchy, visual subject, typography system, role grouping strategy, benefits/contact treatment, trust placement, composition, lighting, colour, depth and mobile behaviour.",
          "Do not output a table.",
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

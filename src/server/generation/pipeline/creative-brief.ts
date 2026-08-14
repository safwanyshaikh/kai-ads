import { getTextGenerationProvider } from "@/server/ai/text";
import type {
  AdvertisementCampaignIdentity,
  AdvertisementContentDensity,
  AdvertisementFacts,
  CreativeArchetype,
  VerifiedAgencyProfile,
} from "./types";

/**
 * ============================================================================
 * KAI CREATIVE DIRECTOR
 * ============================================================================
 *
 * KAI decides:
 *   WHAT must be communicated.
 *
 * GEMINI decides:
 *   HOW the finished advertisement looks.
 *
 * Gemini owns:
 *   - complete visual composition
 *   - hero
 *   - typography
 *   - role presentation
 *   - benefits presentation
 *   - interview presentation
 *   - campaign CTA
 *   - footer composition
 *   - visual hierarchy
 *
 * KAI owns:
 *   - source truth
 *   - campaign identity
 *   - content density strategy
 *   - agency trust rules
 *
 * The downstream branding layer must never rebuild the recruitment body.
 * ============================================================================
 */

/* -------------------------------------------------------------------------- */
/* CAMPAIGN IDENTITY                                                          */
/* -------------------------------------------------------------------------- */

function buildCampaignHeadline(
  facts: AdvertisementFacts,
): string {
  const raw =
    facts.header?.trim() ?? "";

  /**
   * Remove a country suffix from a CRM-style header.
   */
  const withoutCountrySuffix =
    raw
      .replace(
        /\s+[—-]\s+(Saudi Arabia|UAE|United Arab Emirates|Qatar|Kuwait|Bahrain|Oman)\s*$/i,
        "",
      )
      .trim();

  /**
   * CRM-style headers such as:
   *
   * Operation Manager + 18 more roles
   *
   * are not suitable campaign headlines.
   */
  const isCrmRoleHeader =
    /\+\s*\d+\s+more\s+roles?/i.test(
      withoutCountrySuffix,
    ) ||
    /^.+\s+\+\s+\d+\s+more$/i.test(
      withoutCountrySuffix,
    );

  /**
   * 1. Named project.
   */
  if (
    facts.projectType?.trim()
  ) {
    return facts.projectType.trim();
  }

  /**
   * 2. Confirmed employer / client.
   */
  if (
    facts.employer?.trim()
  ) {
    return `${facts.employer.trim()} PROJECT`;
  }

  /**
   * 3. Human-written source header, but only if it is not
   * a CRM "+ more roles" construction.
   */
  if (
    withoutCountrySuffix &&
    !isCrmRoleHeader
  ) {
    return withoutCountrySuffix;
  }

  /**
   * 4. Industry campaign identity.
   */
  if (
    facts.industry?.trim()
  ) {
    return `${facts.industry.trim()} RECRUITMENT`;
  }

  return "OVERSEAS RECRUITMENT OPPORTUNITY";
}

function buildDestinationIndustry(
  facts: AdvertisementFacts,
): string {
  return [
    facts.country?.trim(),
    facts.industry?.trim(),
  ]
    .filter(Boolean)
    .join(" · ");
}

/* -------------------------------------------------------------------------- */
/* CONTENT DENSITY                                                            */
/* -------------------------------------------------------------------------- */

function calculateDensity(
  facts: AdvertisementFacts,
): AdvertisementContentDensity {
  const roleCount =
    facts.positions.length;

  const rolesWithDetails =
    facts.positions.filter(
      (position) =>
        Boolean(
          position.experience ||
            position.salary ||
            position.qualification ||
            position.certifications?.length ||
            position.ageLimit,
        ),
    ).length;

  const contentWeight =
    roleCount +
    rolesWithDetails +
    facts.benefits.length +
    facts.interview.length;

  if (
    contentWeight <= 7
  ) {
    return "LOW";
  }

  if (
    contentWeight <= 16
  ) {
    return "MEDIUM";
  }

  if (
    contentWeight <= 30
  ) {
    return "HIGH";
  }

  return "EXTREME";
}

/**
 * KAI mobile readability rule.
 *
 * This is an internal product quality rule.
 * It is NOT presented as an official platform minimum.
 */
const MIN_ROLE_FONT_PX =
  28;

const MIN_SUPPORTING_FONT_PX =
  22;

function buildDensityDecision(
  facts: AdvertisementFacts,
): {
  density: AdvertisementContentDensity;
  archetype: CreativeArchetype;
  canFitSinglePoster: boolean;
  requiresCarousel: boolean;
} {
  const density =
    calculateDensity(
      facts,
    );

  const roleCount =
    facts.positions.length;

  /**
   * Small requirement:
   * one strong poster.
   */
  if (
    roleCount <= 7 &&
    density !== "HIGH" &&
    density !== "EXTREME"
  ) {
    return {
      density,
      archetype:
        "HERO_RECRUITMENT_POSTER",
      canFitSinglePoster:
        true,
      requiresCarousel:
        false,
    };
  }

  /**
   * Medium requirement:
   * single high-density poster is allowed
   * while maintaining readable role typography.
   */
  if (
    roleCount <= 14 &&
    density !== "EXTREME"
  ) {
    return {
      density,
      archetype:
        "HIGH_DENSITY_RECRUITMENT_POSTER",
      canFitSinglePoster:
        true,
      requiresCarousel:
        false,
    };
  }

  /**
   * Large requirement:
   *
   * DO NOT shrink the role text.
   * DO NOT delete roles.
   * DO NOT write "+ more roles".
   *
   * Change the campaign grammar.
   */
  return {
    density,
    archetype:
      "RECRUITMENT_CAROUSEL",
    canFitSinglePoster:
      false,
    requiresCarousel:
      true,
  };
}

/* -------------------------------------------------------------------------- */
/* VERIFIED AGENCY PACKET                                                     */
/* -------------------------------------------------------------------------- */

function buildAgencyTrustPacket(
  facts: AdvertisementFacts,
): VerifiedAgencyProfile | null {
  if (
    facts.agencyProfile
  ) {
    return {
      ...facts.agencyProfile,

      agencyName:
        facts.agencyProfile
          .agencyName ||
        facts.agencyName,
    };
  }

  /**
   * Temporary compatibility fallback.
   *
   * New canonical data should come from
   * facts.agencyProfile.
   */
  return {
    agencyName:
      facts.agencyName,

    logoUrl:
      null,

    rcNumber:
      facts.raLicenseId ??
      null,

    fullRegistrationNumber:
      facts.fullRegistrationNumber ??
      null,

    meaRegistrationText:
      "Ministry of External Affairs — Government of India Registered",

    isoCertification:
      null,

    isoLogoUrl:
      null,

    registeredAddress:
      facts.officeAddress ??
      null,

    officialPhone:
      null,

    officialEmail:
      null,

    website:
      facts.website ??
      null,

    verificationStatus:
      "UNVERIFIED",

    verificationId:
      null,

    verificationUrl:
      null,

    approvedBadges:
      [],
  };
}

/* -------------------------------------------------------------------------- */
/* CREATIVE BRIEF                                                             */
/* -------------------------------------------------------------------------- */

export async function buildCreativeBrief(
  facts: AdvertisementFacts,
  options?: {
    style?: string;
    theme?: string;
  },
): Promise<string> {
  const provider =
    getTextGenerationProvider();

  const densityDecision =
    buildDensityDecision(
      facts,
    );

  const totalVacancies =
    facts.positions.reduce(
      (sum, position) =>
        sum +
        (position.count ?? 0),
      0,
    );

  const campaignIdentity:
    AdvertisementCampaignIdentity =
      {
        headline:
          buildCampaignHeadline(
            facts,
          ),

        destinationIndustry:
          buildDestinationIndustry(
            facts,
          ),

        country:
          facts.country,

        industry:
          facts.industry,

        projectType:
          facts.projectType ??
          null,

        employer:
          facts.employer ??
          null,

        totalVacancies,

        totalDistinctRoles:
          facts.positions.length,
      };

  const agencyTrust =
    buildAgencyTrustPacket(
      facts,
    );

  /**
   * COMPLETE SOURCE PACKET.
   *
   * Gemini receives the complete recruitment truth.
   * It is never allowed to invent missing information.
   */
  const canonicalContent = {
    campaignIdentity,

    rawSourceHeader:
      facts.header,

    visaType:
      facts.visaType ??
      null,

    dutyHours:
      facts.dutyHours ??
      null,

    rotation:
      facts.rotation ??
      null,

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

    interviewVenue:
      facts.interviewVenue ??
      null,

    campaignContact:
      facts.contact,

    agencyTrust,

    legalDisclaimer:
      facts.legalDisclaimer ??
      null,
  };

  const styleHint =
    options?.style?.trim() ||
    "Premium commercial overseas recruitment advertising";

  const themeHint =
    options?.theme?.trim() ||
    "Professional Gulf recruitment campaign with strong candidate-facing hierarchy";

  const { text } =
    await provider.generateText({
      instructions:
        [
          "You are KAI's Senior Creative Director for a professional overseas recruitment agency.",

          "",

          "CREATE THE COMPLETE COMMERCIAL RECRUITMENT ADVERTISEMENT DIRECTION.",

          "",

          "This is NOT a CRM interface.",
          "This is NOT an ATS record.",
          "This is NOT a spreadsheet.",
          "This is NOT an internal recruitment requirement sheet.",
          "This is NOT a generic background image.",
          "This is NOT a generic AI poster.",

          "",

          "Gemini will create the COMPLETE FINISHED ADVERTISEMENT from your direction.",

          "",

          "================================================================",
          "CAMPAIGN IDENTITY",
          "================================================================",

          `MAIN CAMPAIGN HEADLINE: ${campaignIdentity.headline}`,

          `DESTINATION / INDUSTRY: ${
            campaignIdentity.destinationIndustry ||
            "Use the supplied destination and industry."
          }`,

          `TOTAL VACANCIES: ${totalVacancies}`,

          `DISTINCT ROLES: ${facts.positions.length}`,

          "",

          "CRITICAL HEADLINE RULE:",

          "Never use a database headline such as:",
          "\"Operation Manager + 18 more roles — Saudi Arabia\".",

          "Never use '+ more roles' as the main headline.",

          "Never make one random position the identity of a multi-role recruitment campaign.",

          "The main headline must identify the opportunity, project, employer or recruitment category.",

          "",

          "COUNTRY RULE:",

          "Use the country once in the main campaign hierarchy unless repetition is genuinely useful.",

          "Do not produce:",
          "SAUDI ARABIA",
          "SAUDI ARABIA",
          "SAUDI ARABIA.",

          "Prefer:",
          "CAMPAIGN / PROJECT",
          "SAUDI ARABIA · INDUSTRY.",

          "",

          "================================================================",
          "DENSITY INTELLIGENCE",
          "================================================================",

          `DENSITY: ${densityDecision.density}`,

          `ARCHETYPE: ${densityDecision.archetype}`,

          `SINGLE POSTER APPROPRIATE: ${densityDecision.canFitSinglePoster}`,

          `CAROUSEL REQUIRED: ${densityDecision.requiresCarousel}`,

          `MINIMUM ROLE FONT TARGET: ${MIN_ROLE_FONT_PX}px on the KAI master social canvas.`,

          `MINIMUM SUPPORTING TEXT TARGET: ${MIN_SUPPORTING_FONT_PX}px.`,

          "",

          "DO NOT solve content density by making typography microscopic.",

          "When the full recruitment requirement cannot remain readable in one frame, use a carousel campaign.",

          "All source roles must still be represented across the complete campaign.",

          "Never silently remove roles.",

          "Never use '+ more roles'.",

          "",

          "================================================================",
          "FIXED ADVERTISEMENT SCHEMA",
          "================================================================",

          "HEADER",
          "↓",
          "HERO / INDUSTRY STORY",
          "↓",
          "RECRUITMENT OPPORTUNITY",
          "↓",
          "CANDIDATE ACTION",
          "↓",
          "AGENCY TRUST",

          "",

          "This is a commercial hierarchy, not a rigid rectangular template.",

          "",

          "================================================================",
          "HEADER",
          "================================================================",

          "Create one dominant campaign headline.",

          "Immediately show the destination and industry.",

          "Show the vacancy signal when useful.",

          "Do not turn the header into a database summary.",

          "Do not repeat the country unnecessarily.",

          "",

          "================================================================",
          "HERO / INDUSTRY STORY",
          "================================================================",

          "The viewer should recognise the industry from the visual environment before reading the detailed roles.",

          "Use authentic:",
          "workers",
          "PPE",
          "tools",
          "machinery",
          "architecture",
          "industrial equipment",
          "workplace conditions",
          "materials",
          "climate",
          "scale.",

          "Show people actively performing believable professional work.",

          "Avoid:",
          "posed corporate portraits",
          "handshake photography",
          "generic businessmen",
          "generic office photography.",

          "",

          "The hero must work as a mobile thumbnail.",

          "Create strong foreground, midground and background depth.",

          "Use believable lighting and premium editorial photography.",

          "",

          "================================================================",
          "RECRUITMENT OPPORTUNITY",
          "================================================================",

          "Every supplied position must be represented.",

          "Exact role names remain authoritative.",

          "Exact counts remain authoritative.",

          "Do not silently delete a position.",

          "Do not replace real roles with a generic category that hides them.",

          "You may GROUP roles into meaningful recruitment families when that improves candidate comprehension.",

          "Examples of legitimate families when supported by the actual source:",
          "Management",
          "Engineering / Planning",
          "Procurement",
          "Electrical",
          "Mechanical / HVAC",
          "Civil / Finishing",
          "Quality / HSE",
          "Administration / IT.",

          "Grouping is only a presentation decision.",

          "Do not alter the meaning of the actual positions.",

          "",

          "================================================================",
          "CAROUSEL LAW",
          "================================================================",

          "When CAROUSEL is required:",

          "FRAME 1:",
          "Campaign hero + opportunity identity + destination + industry + strongest candidate-facing hook.",

          "FRAME 2+",
          "Complete readable recruitment role groups.",

          "FINAL FRAME:",
          "Benefits / interview / campaign contact / agency trust as supported by source data.",

          "Every supplied role must appear somewhere in the complete campaign.",

          "Do not hide roles behind '+ more'.",

          "Do not use the first frame as an excuse to omit the recruitment requirement.",

          "",

          "================================================================",
          "CANDIDATE ACTION",
          "================================================================",

          "Use only genuine source-supported information.",

          "Possible candidate-facing sections:",
          "BENEFITS",
          "INTERVIEW",
          "APPLY / CONTACT",
          "OPPORTUNITY HIGHLIGHTS",
          "VERIFY.",

          "Never invent:",
          "salary",
          "benefits",
          "food",
          "accommodation",
          "transport",
          "medical",
          "visa promises",
          "interview venue",
          "interview date",
          "contact numbers",
          "email addresses.",

          "If information is missing, omit it.",

          "",

          "================================================================",
          "INTERVIEW VS AGENCY IDENTITY",
          "================================================================",

          "REGISTERED ADDRESS is permanent agency identity.",

          "INTERVIEW VENUE belongs to THIS campaign.",

          "They are completely different concepts.",

          "Never replace the agency registered address with an interview venue.",

          "",

          "OFFICIAL AGENCY CONTACT is permanent agency identity.",

          "CAMPAIGN CONTACT is specific to THIS recruitment advertisement.",

          "They may differ.",

          "",

          "================================================================",
          "AGENCY TRUST",
          "================================================================",

          "Agency identity is a trust layer, not the visual hero.",

          "The trusted agency packet can contain:",

          "Agency Logo",
          "Agency Name",
          "RC / MEA Registration",
          "Ministry of External Affairs — Government of India Registered",
          "ISO Certification when genuinely approved",
          "ISO Logo when genuinely approved",
          "Registered Address",
          "Official Phone",
          "Official Email",
          "Official Website",
          "Verification QR.",

          "Never invent an agency logo.",

          "Never invent an ISO credential.",

          "Never invent a registration number.",

          "Never invent a verification claim.",

          "",

          "================================================================",
          "FOOTER OWNERSHIP",
          "================================================================",

          "Gemini owns the visual footer composition.",

          "Gemini decides:",
          "footer layout",
          "logo position",
          "QR position",
          "colour",
          "spacing",
          "trust hierarchy.",
          
          "KAI protects the exact verified values.",

          "The footer must not become a second recruitment panel.",

          "",

          "================================================================",
          "TYPOGRAPHY LAW",
          "================================================================",

          "The master social advertisement should be designed around strong mobile readability.",

          "Main headline: dominant and large.",

          "Destination / industry: clearly readable.",

          "Role titles: target at least 28px on the KAI master social canvas.",

          "Supporting candidate information: target at least 22px.",

          "Never shrink the complete advertisement until it becomes difficult to read.",

          "Use hierarchy, grouping and campaign frames instead.",

          "",

          "================================================================",
          "VISUAL DESIGN LANGUAGE",
          "================================================================",

          "The advertisement must look like a professional Gulf recruitment campaign.",

          "Premium editorial photography.",

          "Strong commercial composition.",

          "Real workplace environment.",

          "Strong visual hero.",

          "Professional colour grading.",

          "Clean typography.",

          "Purposeful information hierarchy.",

          "No generic SaaS UI appearance.",

          "No database aesthetics.",

          "No spreadsheet aesthetics.",

          "No giant empty areas.",

          "No giant dark document panel covering the image.",

          "",

          "================================================================",
          "FINAL INTERNAL TEST",
          "================================================================",

          "Before finalising the direction, verify:",

          "1. Is the headline a campaign identity rather than a CRM record?",

          "2. Is the destination clear without unnecessary repetition?",

          "3. Is the industry instantly recognisable?",

          "4. Is the visual hero strong enough for mobile viewing?",

          "5. Are the positions represented accurately?",

          "6. Are the positions readable?",

          "7. Has density been solved through grouping or carousel rather than tiny text?",

          "8. Are benefits and interview details source-grounded?",

          "9. Is campaign contact separated from permanent agency identity?",

          "10. Is registered address separated from interview venue?",

          "11. Is the agency identity trustworthy but secondary?",

          "12. Has anything factual been invented?",

          "",

          `STYLE DIRECTION: ${styleHint}`,

          `THEME DIRECTION: ${themeHint}`,

          "",

          "OUTPUT:",
          "Return ONE detailed creative direction for the Gemini image model.",
          "Do not output software instructions.",
          "Do not output a table.",
          "Do not reproduce all roles as prose.",
        ].join("\n"),

      input:
        JSON.stringify({
          creativeArchetype:
            densityDecision.archetype,

          density:
            densityDecision.density,

          requiresCarousel:
            densityDecision.requiresCarousel,

          campaignIdentity,

          canonicalContent,
        }),
    });

  return text;
}

import { getTextGenerationProvider } from "@/server/ai/text";
import type { AdvertisementFacts } from "./types";

/**
 * KAI CREATIVE DIRECTOR
 *
 * KAI reads the COMPLETE recruitment requirement and creates
 * campaign-level creative direction for Gemini.
 *
 * GEMINI:
 * - visual advertising intelligence
 * - campaign composition
 * - hero subject
 * - environment
 * - lighting
 * - visual storytelling
 * - visual hierarchy
 *
 * KAI:
 * - recruitment intelligence
 * - factual authority
 * - complete requirement context
 * - agency trust architecture
 *
 * This file must NEVER reduce a recruitment requirement to
 * an arbitrary first-N sample of positions.
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

  const styleHint =
    options?.style
      ? `Preferred visual style: ${options.style}.`
      : "Use the strongest commercially appropriate visual style for the recruitment campaign.";

  const themeHint =
    options?.theme
      ? `Preferred colour theme: ${options.theme}.`
      : "Choose a professional colour treatment appropriate to the industry and recruitment campaign.";

  /**
   * COMPLETE REQUIREMENT.
   *
   * Never send only the first few positions.
   */
  const positions =
    facts.positions.map(
      (position) => ({
        title:
          position.title,

        count:
          position.count ??
          null,

        qualification:
          position.qualification ??
          null,

        experience:
          position.experience ??
          null,

        salary:
          position.salary ??
          null,

        certifications:
          position.certifications ??
          [],

        ageLimit:
          position.ageLimit ??
          null,
      }),
    );

  const benefits =
    facts.benefits.map(
      (benefit) => ({
        label:
          benefit.label,

        detail:
          benefit.detail ??
          null,
      }),
    );

  const interviews =
    facts.interview.map(
      (event) => ({
        date:
          event.date ??
          null,

        location:
          event.location ??
          null,
      }),
    );

  const totalVacancies =
    facts.positions.reduce(
      (sum, position) =>
        sum +
        (position.count ?? 0),
      0,
    );

  /**
   * This is the complete intelligence packet
   * supplied to the creative director.
   */
  const campaignContext = {
    employer:
      facts.employer,

    country:
      facts.country,

    industry:
      facts.industry,

    projectType:
      facts.projectType,

    header:
      facts.header,

    visaType:
      facts.visaType,

    dutyHours:
      facts.dutyHours,

    rotation:
      facts.rotation,

    totalVacancies,

    totalDistinctRoles:
      facts.positions.length,

    positions,

    benefits,

    interview:
      interviews,

    contact:
      facts.contact,
  };

  const { text } =
    await provider.generateText({
      instructions:
        "You are KAI's senior Creative Director for a professional overseas recruitment advertising agency. " +

        "\n\nMISSION: " +
        "Create the creative direction for a REAL recruitment advertisement. " +
        "This is not a document, report, spreadsheet, database view, vacancy table, presentation slide or generic background image. " +
        "It is a commercial recruitment campaign intended to make qualified candidates stop scrolling, understand the opportunity and apply. " +

        "\n\n" +
        styleHint +
        " " +
        themeHint +

        "\n\nFIRST PRINCIPLE — UNDERSTAND THE WHOLE REQUIREMENT: " +
        "You have been given the COMPLETE recruitment requirement. " +
        "Understand every role, every vacancy count, the industry, project, destination, experience, benefits and interview information before deciding the creative concept. " +
        "Never ignore roles simply because there are many of them. " +
        "Never assume that the first roles are the most important. " +

        "\n\nCAMPAIGN INTELLIGENCE: " +
        "Decide what the recruitment opportunity is really selling to the candidate. " +
        "Identify the strongest candidate-facing hook from the supplied facts. " +
        "Identify the industry visually. " +
        "Identify the project environment visually. " +
        "Identify the type of worker or professional who should become the visual hero. " +
        "Identify the strongest supporting visual elements. " +

        "\n\nOVERSEAS RECRUITMENT ADVERTISING STANDARD: " +
        "Think like a senior overseas recruitment agency's advertising team. " +
        "The candidate should immediately recognise WE ARE HIRING, WHERE, FOR WHAT INDUSTRY OR PROJECT and WHAT KIND OF JOBS. " +
        "The advertisement must feel like a genuine live recruitment opportunity, not a corporate presentation. " +

        "\n\nINDUSTRY RECOGNITION IS MANDATORY: " +
        "The visual environment must make the industry recognisable without needing to read the job list. " +
        "Oil and Gas should look like Oil and Gas. " +
        "Construction should look like Construction. " +
        "Shipyard and Marine should look like Shipyard and Marine. " +
        "Manufacturing should look like Manufacturing. " +
        "Hospitality should look like Hospitality. " +
        "Healthcare should look like Healthcare. " +
        "Agriculture should look like Agriculture. " +
        "Energy and Power should look like Energy and Power. " +
        "Use real equipment, real environments, believable workers and authentic activity. " +

        "\n\nVISUAL HERO: " +
        "Choose one dominant human or activity-based visual subject. " +
        "The subject must be large enough to recognise immediately on a phone. " +
        "Prefer a real worker actively performing believable work rather than posing. " +
        "Use realistic PPE, tools, machinery, posture and working conditions. " +

        "\n\nVISUAL STORY: " +
        "Build the image like a premium advertising campaign. " +
        "Create foreground, midground and background depth. " +
        "Choose a deliberate camera angle. " +
        "Choose believable lighting. " +
        "Create atmosphere and scale. " +
        "Make the image emotionally communicate professional opportunity, technical skill, career progression, trust and urgency where those qualities are supported by the facts. " +

        "\n\nDO NOT CREATE A TEMPLATE: " +
        "Do not create a rigid grid merely because there are many positions. " +
        "Do not create spreadsheet rows. " +
        "Do not create a giant information card. " +
        "Do not create a presentation slide. " +
        "Do not create a SaaS dashboard. " +
        "Do not create an empty background waiting for text. " +
        "Do not make the photograph subordinate to a document-like layout. " +

        "\n\nCOMPLETE ROLE COVERAGE: " +
        "The complete requirement must influence the campaign concept. " +
        "Do not invent roles. " +
        "Do not delete roles from the recruitment intelligence. " +
        "Do not represent a multi-role requirement as though only one position exists. " +
        "When the number of roles is large, think in terms of recruitment categories and campaign structure rather than shrinking every role into unreadable text. " +

        "\n\nCONTENT DENSITY INTELLIGENCE: " +
        "If the complete opportunity can be communicated clearly on one advertisement, create one powerful advertisement. " +
        "If the requirement is too information-rich for one advertisement to remain readable, the commercial solution is a coordinated multi-frame campaign or carousel. " +
        "Never solve information density by making everything microscopic. " +
        "Never hide legitimate roles behind '+ more roles'. " +
        "Never silently drop recruitment categories. " +

        "\n\nSINGLE ADVERTISEMENT PRINCIPLE: " +
        "When one canvas can communicate the complete opportunity clearly, create one strong recruitment advertisement with a dominant visual, strong headline hierarchy, concise role grouping and clear candidate action. " +

        "\n\nCAROUSEL PRINCIPLE: " +
        "When the requirement is information-rich, think as a coordinated recruitment campaign. " +
        "The campaign should have a strong hero frame followed by logically grouped recruitment frames where necessary. " +
        "All frames must share the same visual identity, industry recognition, destination and recruitment campaign feel. " +
        "Do not invent additional information. " +

        "\n\nFACTUAL RESPONSIBILITY: " +
        "KAI is the authority for exact recruitment facts. " +
        "Gemini must never invent job titles, vacancy numbers, salaries, benefits, interview dates, locations, visa conditions, employer names, registration numbers or contact information. " +

        "\n\nTEXT RENDERING RULE: " +
        "Do not render fake recruitment facts into the photographic artwork. " +
        "Do not invent phone numbers, email addresses, vacancy counts, registration numbers or QR codes. " +
        "Exact trusted recruitment information is controlled by KAI. " +

        "\n\nAGENCY BRANDING: " +
        "Agency identity is a trust element, not the hero. " +
        "The recruitment opportunity must dominate. " +
        "Agency logo, registration and verification belong in controlled trust architecture, normally toward the bottom of the final advertisement. " +

        "\n\nCTA THINKING: " +
        "The campaign must have a natural visual place for the candidate's next action: send CV, contact recruitment team, attend interview, scan to verify or another action supported by the supplied facts. " +
        "Never invent contact information. " +

        "\n\nBENEFIT COMMUNICATION: " +
        "When genuine benefits exist in the supplied requirement, leave a natural visual opportunity for compact benefit communication such as accommodation, food, transport, medical, visa or duty hours. " +
        "Never invent benefits. " +

        "\n\nMOBILE-FIRST: " +
        "The advertisement will primarily be consumed on WhatsApp, Instagram, Facebook, LinkedIn and Telegram. " +
        "The visual must work at thumbnail size. " +
        "The dominant opportunity hook must be immediately understandable. " +
        "Avoid tiny decorative detail that disappears on mobile. " +

        "\n\nVISUAL QUALITY BAR: " +
        "Premium editorial advertising photography. " +
        "Realistic people. " +
        "Realistic industrial environments. " +
        "Believable scale. " +
        "Professional lighting. " +
        "Strong composition. " +
        "Clear subject hierarchy. " +
        "Commercially attractive. " +
        "No generic stock-photo feeling. " +
        "No fantasy machinery. " +
        "No generic businessman. " +
        "No meaningless decorative imagery. " +

        "\n\nMOST IMPORTANT: " +
        "The final advertisement must look like something a serious overseas recruitment agency would actually publish to attract candidates. " +
        "It must not look like a recruitment requirement document converted into a poster. " +

        "\n\nOUTPUT: " +
        "Return ONE detailed creative-direction paragraph for the Gemini image model. " +
        "Describe the complete campaign concept, dominant visual subject, industry environment, human action, camera perspective, lighting, depth, colour mood, visual hierarchy, recruitment communication strategy and emotional effect. " +
        "Do not write advertising copy. " +
        "Do not reproduce the supplied job list as prose. " +
        "Do not create a table. " +
        "Do not describe a software interface.",

      input:
        JSON.stringify(
          campaignContext,
        ),
    });

  return text;
}

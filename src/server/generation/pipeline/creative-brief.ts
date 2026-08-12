import { getTextGenerationProvider } from "@/server/ai/text";
import type { AdvertisementFacts } from "./types";

/**
 * KAI CREATIVE DIRECTOR
 *
 * KAI reads the COMPLETE recruitment requirement and creates
 * a campaign-level creative direction for Gemini.
 *
 * IMPORTANT:
 *
 * Gemini = visual advertising intelligence.
 * KAI = recruitment intelligence + factual authority.
 *
 * Gemini must think like a professional advertising agency:
 * understand the opportunity, identify the industry, choose the
 * hero subject, choose the environment, choose the camera,
 * lighting, visual hierarchy and campaign feel.
 *
 * KAI must never reduce a large recruitment requirement into
 * an arbitrary "first N positions" sample.
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
      ? `Preferred visual style: ${options.style}. `
      : "";

  const themeHint =
    options?.theme
      ? `Preferred colour theme: ${options.theme}. `
      : "";

  /**
   * CRITICAL:
   *
   * Send the COMPLETE recruitment intelligence.
   *
   * Never slice positions to an arbitrary number.
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

        aramcoExperience:
          position.aramcoExperience ??
          null,

        remark:
          position.remark ??
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
        "You are KAI's senior Creative Director for a professional " +
        "overseas recruitment advertising agency. " +

        "\n\nMISSION: " +
        "Create the creative direction for a REAL recruitment advertisement. " +
        "This is not a document, report, spreadsheet, database view, vacancy table, " +
        "presentation slide or generic background image. " +
        "It is a commercial recruitment campaign intended to make qualified candidates " +
        "stop scrolling, understand the opportunity and apply. " +

        "\n\nFIRST PRINCIPLE — UNDERSTAND THE WHOLE REQUIREMENT: " +
        "You have been given the COMPLETE recruitment requirement. " +
        "Understand every role, every vacancy count, the industry, project, destination, " +
        "experience, benefits and interview information before deciding the creative concept. " +
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
        "The candidate should immediately recognise: " +
        "WE ARE HIRING + WHERE + FOR WHAT INDUSTRY/PROJECT + WHAT KIND OF JOBS. " +
        "The advertisement must feel like a genuine live recruitment opportunity, " +
        "not a corporate presentation. " +

        "\n\nINDUSTRY RECOGNITION IS MANDATORY: " +
        "The visual environment must make the industry recognisable without needing " +
        "to read the job list. " +
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
        "Make the image emotionally communicate professional opportunity, technical skill, " +
        "career progression, trust and urgency where those qualities are supported by the facts. " +

        "\n\nDO NOT CREATE A TEMPLATE: " +
        "Do not create a rigid grid merely because there are many positions. " +
        "Do not create spreadsheet rows. " +
        "Do not create a giant information card. " +
        "Do not create a presentation slide. " +
        "Do not create a SaaS dashboard. " +
        "Do not create an empty background waiting for text. " +
        "Do not make the photograph subordinate to a document-like layout. " +

        "\n\nCONTENT DENSITY INTELLIGENCE: " +
        "Consider the complete amount of recruitment information. " +
        "If the opportunity is naturally compact, imagine one powerful recruitment advertisement. " +
        "If the requirement is information-rich, imagine a campaign composition capable of " +
        "presenting the opportunity without destroying readability or visual quality. " +
        "Do not solve information density by making everything tiny. " +
        "Do not hide roles behind '+ more roles'. " +
        "Do not drop recruitment categories. " +

        "\n\nSINGLE ADVERTISEMENT PRINCIPLE: " +
        "When one canvas can communicate the complete opportunity clearly, create one strong " +
        "advertisement concept with a dominant visual and carefully integrated information zones. " +

        "\n\nCAMPAIGN / CAROUSEL PRINCIPLE: " +
        "When the requirement is too information-rich for one advertisement to remain readable, " +
        "the correct commercial solution is a coordinated multi-frame recruitment campaign rather " +
        "than compressing everything into microscopic typography. " +
        "Frames must belong to one visual campaign and must preserve every recruitment category. " +
        "Do not invent additional campaign information. " +

        "\n\nFACTUAL RESPONSIBILITY: " +
        "KAI is the authority for exact recruitment facts. " +
        "Gemini must never invent job titles, vacancy numbers, salaries, benefits, interview dates, " +
        "locations, visa conditions, employer names, registration numbers or contact information. " +

        "\n\nTEXT RENDERING RULE: " +
        "Do not render readable recruitment text, phone numbers, email addresses, vacancy numbers, " +
        "QR codes, registration numbers, fake logos, watermarks or fabricated signage in the image. " +
        "KAI handles exact factual information separately. " +

        "\n\nAGENCY BRANDING: " +
        "Agency identity is a trust element, not the hero. " +
        "The recruitment opportunity must dominate. " +
        "Agency logo, registration and verification belong in controlled trust architecture, " +
        "normally toward the bottom of the final advertisement. " +

        "\n\nCTA THINKING: " +
        "The campaign must have a natural visual place for the candidate's next action: " +
        "send CV, contact recruitment team, attend interview, scan to verify or equivalent " +
        "source-grounded action. " +
        "Do not invent contact information. " +

        "\n\nBENEFIT COMMUNICATION: " +
        "When genuine benefits exist in the supplied requirement, the creative should leave " +
        "a natural visual opportunity for compact benefit communication such as accommodation, " +
        "food, transport, medical, visa or duty hours. " +
        "Never invent benefits. " +

        "\n\nMOBILE-FIRST: " +
        "The advertisement will primarily be consumed on WhatsApp, Instagram, Facebook, " +
        "LinkedIn and Telegram. " +
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
        "No flags unless genuinely required by the campaign. " +

        "\n\nMOST IMPORTANT: " +
        "The final advertisement must look like something a serious overseas recruitment " +
        "agency would actually publish to attract candidates. " +
        "It must not look like a requirement document converted into a poster. " +

        "\n\nOUTPUT: " +
        "Return ONE detailed creative-direction paragraph for the Gemini image model. " +
        "The paragraph must describe the complete campaign concept, dominant visual subject, " +
        "industry environment, human action, camera perspective, lighting, depth, colour mood, " +
        "visual hierarchy and emotional effect. " +
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

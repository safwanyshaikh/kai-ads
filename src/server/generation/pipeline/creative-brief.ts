import { getTextGenerationProvider } from "@/server/ai/text";
import { BRANDING_RESERVED_HEIGHT_PCT } from "./branding-overlay";
import type { AdvertisementFacts } from "./types";

/**
 * How many position lines stay legible on one canvas, as a function of how
 * many there are. Real requirements range from a single role to the 126
 * titles across 19 departments in the Halliburton reference; a fixed cap
 * either wastes the canvas on small ads or produces unreadable 6pt type on
 * big ones.
 *
 * Small lists print in full with room for per-role detail (salary,
 * experience, qualification). Larger lists print progressively fewer roles
 * in a denser list, because past roughly a dozen lines the per-role detail
 * has to go anyway. Beyond that the ad prints a representative subset and
 * states the true total — accurate summarisation, never a silent drop.
 */
export function maxCanvasPositions(total: number): number {
  if (total <= 6) return total; // 1-6 roles: print every one, with detail
  if (total <= 12) return total; // up to 12: still legible in full
  if (total <= 30) return 12; // 20-ish: dense list, subset + true total
  return 10; // 50+: fewer lines, since the total carries the message
}

/**
 * KAI writes ONE creative brief, in plain language, ready to hand straight
 * to GPT Image. One call, no schema, no engines — GPT Image composes the
 * entire advertisement from this brief (Supreme Constitution Principle 2).
 *
 * Text-rendering strategy: image models garble *invented editorial prose*
 * far more than short factual strings. Across this project's live runs,
 * every unreadable string ("EXACT POITIOES", "advancementes", "STABLE CULF
 * CARPEDIAATE CAREER") came from marketing copy the brief asked for, while
 * position titles, counts, salaries, phone numbers and dates rendered
 * correctly. So the brief now asks for rich *visual* direction — imagery,
 * colour, composition, which never garbles — while keeping the text that
 * actually gets rendered short, factual, and enumerated.
 */
export async function buildCreativeBrief(
  facts: AdvertisementFacts,
  options?: { style?: string; theme?: string },
): Promise<string> {
  const provider = getTextGenerationProvider();

  const styleHint = options?.style ? `Preferred visual style: ${options.style}. ` : "";
  const themeHint = options?.theme ? `Preferred colour theme: ${options.theme}. ` : "";

  const totalPositions = facts.positions.length;
  const cap = maxCanvasPositions(totalPositions);
  const overflow = totalPositions - cap;
  const canvasFacts = overflow > 0 ? { ...facts, positions: facts.positions.slice(0, cap) } : facts;
  const overflowRule =
    overflow > 0
      ? `\n\nThis requirement has ${totalPositions} positions in total — too many to print legibly. ` +
        `Print EXACTLY the ${cap} positions listed below as individual lines, no more and no fewer. ` +
        `Do not add a line for a role that is not in that list, and do not split or restate one of them. ` +
        `The ad MUST also state the true total in words the reader can trust, exactly: ` +
        `"${totalPositions} positions available". Never imply the printed list is the complete list, ` +
        `and never invent a position title to pad it. ` +
        `With this many roles, keep each line to the role title and vacancy count so the list stays legible. `
      : `\n\nPrint EXACTLY the ${totalPositions} position${totalPositions === 1 ? "" : "s"} listed below — ` +
        `no more and no fewer. Do not add a role that is not listed, and do not restate one of them as a ` +
        `second line. There is room here for per-role detail (vacancies, experience, salary, qualification) ` +
        `where those facts are given. `;

  const { text } = await provider.generateText({
    instructions:
      "You are a senior recruitment advertising creative director for the Gulf/GCC overseas-recruitment market. " +
      "Read the grounded recruitment facts below and write ONE creative brief for an image-generation " +
      "model to turn directly into a finished, publication-ready recruitment advertisement. " +
      "\n\nSplit your brief into two clearly separate concerns. " +
      "\n(1) VISUAL DIRECTION — be rich and specific here: the hero image concept, the industry and destination " +
      "setting, photographic style, lighting, composition, visual hierarchy, typography mood, and colour " +
      "direction. This part costs nothing to get wrong-ish and carries the ad's professionalism. " +
      styleHint + themeHint +
      "\n(2) TEXT TO RENDER — be ruthless and minimal here. Enumerate the exact strings the image model should " +
      "print on the canvas and nothing else. Every printed string must be either a grounded fact from below or " +
      "a short factual label for one ('Positions', 'Benefits', 'Interview'). " +
      "\n\nCritical text-rendering rule: image models garble long invented sentences far more than short factual " +
      "strings. Do NOT ask the image model to print emotional taglines, motivational slogans, editorial " +
      "sentences, or marketing prose — no 'seize the opportunity', no 'stable rewarding career', no " +
      "'immediate deployment for reliable overseas employment'. Those lines are exactly what renders as " +
      "unreadable garbage and they sell nothing. Apart from a single short headline naming the role area and " +
      "destination, every printed word must be a fact the candidate needs: position titles, vacancy counts, " +
      "experience, salary, benefits, interview date and venue, contact details. " +
      "Include every concrete fact given below exactly as given — word for word where it is a number, code, or " +
      "name. A short, correctly rendered line always beats a longer line that risks a typo or a dropped digit. " +
      "\n\nZero fabrication, no exceptions: never invent a phone number, email, website, QR code, company name, " +
      "brand name, client name, salary figure, benefit, address, visa type, duty-hours figure, rotation pattern, " +
      "certification, qualification, or licence number. If a detail is not present in the facts below, " +
      "it does not exist for this brief — do not guess it, do not imply one exists. " +
      "\n\nThe facts may carry optional commercial detail — project name, visa type, duty hours, rotation, " +
      "accommodation/food/transport/medical benefits, per-role qualification and certifications, interview date " +
      "and venue. Print each one ONLY where it is present and non-null. Where a field is absent, omit its label " +
      "and its section entirely: an ad with four true rows is correct, an ad with six rows where two were " +
      "guessed is a defect. Never print an empty label, a dash, or 'N/A' to fill a gap. " +
      "If a legal disclaimer is supplied, reproduce it verbatim and never write one of your own. " +
      "Never instruct the image model to draw a QR code, phone number, or any contact element unless one is " +
      "literally present in the facts. " +
      "\n\nNo placeholder text, ever: never instruct the image model to write things like 'CONTACT HERE', " +
      "'APPLY HERE', 'YOUR EMAIL', 'INSERT NUMBER', or 'CALL NOW: ___'. If the facts give no contact details, " +
      "tell the image model to end the ad on its strongest benefit or urgency line instead — omit the " +
      "contact/CTA section completely rather than leaving a blank or a placeholder. " +
      `\n\nLeave the bottom ${BRANDING_RESERVED_HEIGHT_PCT}% of the canvas (a horizontal strip along the very ` +
      "bottom edge) completely free of any text, logos, or busy detail — that strip is reserved for KAI's own " +
      "verification branding, which is painted opaquely over it, and anything the ad draws there will be erased. " +
      "Finish all ad copy above that line: it is better to drop a decorative line entirely than to let a factual " +
      "line run into the reserved strip and be cut in half. Plan the layout so the LAST factual line ends well " +
      "clear of that strip — leave visible empty space above it rather than filling the canvas edge to edge. " +
      overflowRule +
      "\n\nWrite the VISUAL DIRECTION as flowing prose. Write the TEXT TO RENDER as an explicit list of the " +
      "exact strings to print, so the image model has no room to improvise copy of its own.",
    input: JSON.stringify(canvasFacts),
  });

  return text;
}

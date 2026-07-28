import { getTextGenerationProvider } from "@/server/ai/text";
import { BRANDING_RESERVED_HEIGHT_PCT } from "./branding-overlay";
import type { AdvertisementFacts } from "./types";

/**
 * The most positions that stay legible on one canvas. Real bulk
 * requirements run to 100+ titles across many departments; rendering all
 * of them produces either unreadable 6pt type or a silent drop of most of
 * the list. Above this cap the ad shows a representative subset and states
 * the true total, which is accurate summarisation rather than omission.
 */
const MAX_CANVAS_POSITIONS = 8;

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
  const overflow = totalPositions - MAX_CANVAS_POSITIONS;
  const canvasFacts =
    overflow > 0 ? { ...facts, positions: facts.positions.slice(0, MAX_CANVAS_POSITIONS) } : facts;
  const overflowRule =
    overflow > 0
      ? `\n\nThis requirement has ${totalPositions} positions in total — too many to print legibly. ` +
        `Only the ${MAX_CANVAS_POSITIONS} positions listed below may be printed as individual lines. ` +
        `The ad MUST also state the true total in words the reader can trust, exactly: ` +
        `"${totalPositions} positions available". Never imply the printed list is the complete list, ` +
        `and never invent a position title to pad it. `
      : "";

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
      "brand name, client name, salary figure, benefit, or address. If a detail is not present in the facts below, " +
      "it does not exist for this brief — do not guess it, do not imply one exists. " +
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

import { getOpenAiClient, getKaiTextModel } from "@/server/ai/openai/openai-client";

/**
 * V2 — Step 2: KAI understands the recruitment requirement and writes
 * ONE creative brief, in plain language, ready to hand straight to GPT
 * Image. One call, no schema, no engines.
 */
export async function buildCreativeBrief(recruiterText: string): Promise<string> {
  const client = getOpenAiClient();

  const response = await client.responses.create({
    model: getKaiTextModel(),
    instructions:
      "You are a senior recruitment advertising creative director for the Gulf/GCC overseas-recruitment market. " +
      "Read the recruiter's raw requirement below and write ONE rich, vivid creative brief for an image-generation " +
      "model to turn directly into a finished, publication-ready recruitment advertisement. " +
      "Describe: the industry and destination, the emotional hook and candidate motivation, hiring urgency, " +
      "a hero image concept, visual storytelling, typography mood, and colour direction. " +
      "Include every concrete fact from the requirement (positions, salary, benefits, contact details, experience, " +
      "location) exactly as given — accurately render every provided factual detail, word for word where it is a " +
      "number, code, or name. Prefer fewer words with high accuracy over more decorative copy: a short, correctly " +
      "rendered line beats a longer line that risks a typo or a dropped digit. " +
      "\n\nZero fabrication, no exceptions: never invent a phone number, email, website, QR code, company name, " +
      "brand name, client name, salary figure, benefit, or address. If a detail is not explicitly present in the " +
      "requirement below, it does not exist for this brief — do not guess it, do not imply one exists. " +
      "Never instruct the image model to draw a QR code, phone number, or any contact element unless one is " +
      "literally present in the requirement text. " +
      "\n\nNo placeholder text, ever: never instruct the image model to write things like 'CONTACT HERE', " +
      "'APPLY HERE', 'YOUR EMAIL', 'INSERT NUMBER', or 'CALL NOW: ___'. If the requirement gives no contact " +
      "details, tell the image model to end the ad on its strongest benefit or urgency line instead — omit the " +
      "contact/CTA section completely rather than leaving a blank or a placeholder. " +
      "\n\nLeave the bottom 12% of the canvas (a horizontal strip along the very bottom edge) free of any text, " +
      "logos, or busy detail — that strip is reserved for KAI's own verification branding and must not be drawn " +
      "into or covered by ad copy. " +
      "\n\nWrite the brief as flowing prose instructions for the image model, not a form or a list of fields.",
    input: recruiterText,
  });

  return response.output_text;
}

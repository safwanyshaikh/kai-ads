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
      "location) exactly as given — never invent or alter a fact that wasn't provided. " +
      "Write the brief as flowing prose instructions for the image model, not a form or a list of fields.",
    input: recruiterText,
  });

  return response.output_text;
}

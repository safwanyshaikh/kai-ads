import { GoogleGenAI } from "@google/genai";
import { getEnv } from "@/lib/env";
import { AiNotConfiguredError } from "../openai/errors";

let cachedTextClient: GoogleGenAI | null = null;
let cachedImageClient: GoogleGenAI | null = null;

/**
 * Independent client for text/vision extraction (Option A: text and image
 * generation migrate to Gemini on separate schedules, each with its own
 * key and its own rollback). The only place `new GoogleGenAI(...)` is
 * called for text — everything else depends on the provider interfaces,
 * not this client directly (mirrors openai/openai-client.ts).
 */
export function getGeminiTextClient(): GoogleGenAI {
  const env = getEnv();
  if (!env.GEMINI_TEXT_API_KEY) {
    throw new AiNotConfiguredError();
  }
  if (!cachedTextClient) {
    cachedTextClient = new GoogleGenAI({ apiKey: env.GEMINI_TEXT_API_KEY });
  }
  return cachedTextClient;
}

/** Independent client for image generation — see getGeminiTextClient() above. */
export function getGeminiImageClient(): GoogleGenAI {
  const env = getEnv();
  if (!env.GEMINI_IMAGE_API_KEY) {
    throw new AiNotConfiguredError();
  }
  if (!cachedImageClient) {
    cachedImageClient = new GoogleGenAI({ apiKey: env.GEMINI_IMAGE_API_KEY });
  }
  return cachedImageClient;
}

/**
 * Centralized model resolution — "Do not hardcode model names throughout
 * the application." Reuses the exact same env-backed getters the OpenAI
 * client uses (KAI_TEXT_MODEL / KAI_VISION_MODEL / KAI_IMAGE_MODEL are
 * provider-agnostic variable names already; only the value changes per
 * deployment, e.g. "gemini-2.5-flash" instead of "gpt-4.1").
 */
export { getKaiTextModel, getKaiVisionModel } from "../openai/openai-client";

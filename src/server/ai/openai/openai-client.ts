import OpenAI from "openai";
import { getEnv } from "@/lib/env";
import { AiNotConfiguredError } from "./errors";

let cachedClient: OpenAI | null = null;

/**
 * The only place `new OpenAI(...)` is called. Everything else in the
 * codebase depends on the provider interfaces from Sprint 002, not on
 * this client directly — see src/server/ai/openai/kai-extraction-provider.ts.
 */
export function getOpenAiClient(): OpenAI {
  const env = getEnv();
  if (!env.OPENAI_API_KEY) {
    throw new AiNotConfiguredError();
  }

  if (!cachedClient) {
    cachedClient = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  }
  return cachedClient;
}

/** Centralized model resolution — "Do not hardcode model names throughout the application." */
export function getKaiTextModel(): string {
  return getEnv().KAI_TEXT_MODEL;
}

export function getKaiVisionModel(): string {
  return getEnv().KAI_VISION_MODEL;
}

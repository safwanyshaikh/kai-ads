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
    // Sprint 008 Workstream A: never run on the SDK's defaults (600s
    // timeout / 2 retries) — a serverless function is killed by the
    // platform long before 600s, turning every slow generation into an
    // opaque platform kill instead of a clean, logged application error.
    // Both budgets are env-tunable; the timeout must stay below the
    // calling route's maxDuration.
    cachedClient = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
      timeout: env.KAI_OPENAI_TIMEOUT_MS,
      maxRetries: env.KAI_OPENAI_MAX_RETRIES,
    });
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

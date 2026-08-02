import { getIntegrationStatus } from "@/lib/env";
import type { TranscriptionProvider } from "./transcription-provider.interface";
import { OpenAiTranscriptionProvider } from "./openai-transcription-provider";

export * from "./transcription-provider.interface";

let cachedProvider: TranscriptionProvider | null | undefined;

/**
 * Same OPENAI_API_KEY-gated pattern as getTextGenerationProvider() and
 * getImageGenerationProvider().
 *
 * Returns null when unconfigured rather than a stand-in that throws,
 * because the caller has a genuinely better option than failing: a voice
 * note that cannot be transcribed is reported to the recruiter as "this
 * source could not be read", the OTHER sources on the same requirement
 * are still processed, and the requirement still produces a JobOrder.
 * Silence about one channel must never take down the whole intake.
 */
export function getTranscriptionProvider(): TranscriptionProvider | null {
  if (cachedProvider !== undefined) return cachedProvider;
  cachedProvider = getIntegrationStatus().openai ? new OpenAiTranscriptionProvider() : null;
  return cachedProvider;
}

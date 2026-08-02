import { toFile } from "openai";
import { getOpenAiClient } from "@/server/ai/openai/openai-client";
import { getEnv } from "@/lib/env";
import type {
  TranscriptionInput,
  TranscriptionProvider,
  TranscriptionUsage,
} from "./transcription-provider.interface";

/**
 * OpenAI-backed voice-note transcription.
 *
 * Produces a transcript and nothing else — no summarizing, no
 * interpreting, no filling in what the speaker trailed off on. The
 * transcript then goes through exactly the same extraction path as any
 * other text source, so a voice note is subject to the same
 * source-grounding rules as a PDF. Speech is a channel, not a shortcut
 * around the Truth Brain.
 */
export class OpenAiTranscriptionProvider implements TranscriptionProvider {
  readonly name = "openai";

  async transcribe(input: TranscriptionInput): Promise<{ text: string; usage: TranscriptionUsage }> {
    const client = getOpenAiClient();
    const model = getEnv().KAI_TRANSCRIPTION_MODEL;
    const startedAt = Date.now();

    const file = await toFile(input.audio, input.fileName, { type: input.mimeType });

    const response = await client.audio.transcriptions.create({
      file,
      model,
      // No language is forced unless the caller insists: overseas
      // recruitment voice notes routinely code-switch mid-sentence, and
      // pinning one language degrades the transcript.
      ...(input.language ? { language: input.language } : {}),
    });

    return {
      text: typeof response.text === "string" ? response.text : "",
      usage: { model, latencyMs: Date.now() - startedAt },
    };
  }
}

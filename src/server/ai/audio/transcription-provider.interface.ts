/**
 * Voice-note transcription — provider contract.
 *
 * Requirements genuinely arrive as voice notes: an agent walks out of a
 * meeting with a principal and forwards a 90-second WhatsApp recording
 * with the whole demand in it. Task 002 accepts that channel, so the
 * engine needs a way to turn speech into text.
 *
 * Same seam shape as every other provider in this codebase
 * (text/, image/, visual-qa/): an interface, a gated
 * get*Provider() factory, and a loud NotImplemented stand-in rather
 * than a silent mock — "not configured" is always an explicit failure.
 */

export interface TranscriptionInput {
  audio: Buffer;
  /** e.g. "audio/ogg" for a WhatsApp voice note, "audio/mpeg", "audio/mp4". */
  mimeType: string;
  fileName: string;
  /**
   * Optional BCP-47 hint. Left unset by default: overseas recruitment
   * voice notes are routinely code-switched (Hindi/Malayalam/English in
   * one sentence) and forcing a single language makes transcription
   * worse, not better.
   */
  language?: string;
}

export interface TranscriptionUsage {
  model: string;
  latencyMs: number;
}

export interface TranscriptionProvider {
  readonly name: string;
  transcribe(input: TranscriptionInput): Promise<{ text: string; usage: TranscriptionUsage }>;
}
